import { useQueries, useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, { createContext, useContext, useMemo, useState } from 'react'
import type { ValueMeta } from '@/registry/dhis2/value-display/formatDhis2Value'
import type { EventEntryData } from './toEventEntry'
import { useTimelineState } from '../ui/TimelineContext'
import { fetchOrgUnitNames, fetchProgramTimelineMetadata } from './queries'
import type { OrgUnitName, ProgramTimelineMetadata } from './schemas'
import { timelineKeys } from './timelineKeys'
import { useTimelineClient } from './useTimelineClient'

export interface ValueInfo {
    name: string
    meta: ValueMeta
}

export interface StageInfo {
    name: string
    hideDueDate: boolean
    /** The elements flagged `displayInReports`, in stage order. */
    reportDataElementIds: string[]
    dataElements: ReadonlyMap<string, ValueInfo>
}

export interface TimelineDhis2Value {
    status: 'loading' | 'error' | 'success'
    error?: Error
    stages: ReadonlyMap<string, StageInfo>
    attributes: ReadonlyMap<string, ValueInfo>
    /** What is known so far; a part shows the id for the rest. */
    orgUnitNames: ReadonlyMap<string, string>
}

const NO_STAGES: ReadonlyMap<string, StageInfo> = new Map()
const NO_VALUES: ReadonlyMap<string, ValueInfo> = new Map()
const NO_NAMES: ReadonlyMap<string, string> = new Map()

const valueInfo = (source: {
    displayName: string
    displayFormName?: string
    valueType: string
    optionSet?: ValueMeta['optionSet']
}): ValueInfo => ({
    name: source.displayFormName ?? source.displayName,
    meta: { valueType: source.valueType, optionSet: source.optionSet },
})

const toStages = (
    metadata: ProgramTimelineMetadata
): ReadonlyMap<string, StageInfo> =>
    new Map(
        metadata.programStages.map((stage) => [
            stage.id,
            {
                name: stage.displayName,
                hideDueDate: stage.hideDueDate,
                reportDataElementIds: stage.programStageDataElements
                    .filter((element) => element.displayInReports)
                    .map((element) => element.dataElement.id),
                dataElements: new Map(
                    stage.programStageDataElements.map(({ dataElement }) => [
                        dataElement.id,
                        valueInfo(dataElement),
                    ])
                ),
            },
        ])
    )

const toAttributes = (
    metadata: ProgramTimelineMetadata
): ReadonlyMap<string, ValueInfo> =>
    new Map(
        metadata.programTrackedEntityAttributes.map(
            ({ trackedEntityAttribute }) => [
                trackedEntityAttribute.id,
                valueInfo(trackedEntityAttribute),
            ]
        )
    )

const combineNames = (
    results: ReadonlyArray<{ data?: ReadonlyArray<OrgUnitName> }>
): ReadonlyMap<string, string> => {
    const names = new Map<string, string>()
    for (const { data } of results) {
        for (const { id, displayName } of data ?? []) {
            names.set(id, displayName)
        }
    }
    return names.size === 0 ? NO_NAMES : names
}

const TimelineDhis2Context = createContext<TimelineDhis2Value | null>(null)

/** Org unit ids of the event entries in the feed, sorted and unique. */
const useFeedOrgUnitIds = (): string => {
    // A joined string is a primitive, so the provider re-renders only when the
    // set of ids changes, not on every state update.
    return useTimelineState<EventEntryData, string>((state) =>
        [
            ...new Set(
                state.entries.flatMap((entry) => {
                    const orgUnit =
                        entry.sourceKey === 'events'
                            ? entry.data.event.orgUnit
                            : undefined
                    return orgUnit ? [orgUnit] : []
                })
            ),
        ]
            .sort()
            .join(',')
    )
}

/**
 * Program metadata (stages, data elements, attributes) and the names of the
 * org units on the feed's events, for the entry parts. Place it inside
 * `Timeline`; it takes calendar, locale and today from the timeline's meta.
 */
export const TimelineDhis2Provider = ({
    program,
    children,
}: {
    program: string
    children: React.ReactNode
}) => {
    const client = useTimelineClient()

    const metadataQuery = useQuery({
        queryKey: timelineKeys.programMetadata(program),
        // Static metadata: never refetched behind the user's back.
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        queryFn: async ({ signal }) => {
            const result = await fetchProgramTimelineMetadata(
                client,
                { program },
                signal
            )
            if (Result.isError(result)) {
                throw result.error
            }
            return result.value
        },
    })

    // One request per batch of ids not asked about before. Adjusting state
    // while rendering is the documented way to derive it from other state.
    const idList = useFeedOrgUnitIds()
    const [batches, setBatches] = useState<
        ReadonlyArray<ReadonlyArray<string>>
    >([])
    const asked = new Set(batches.flat())
    const fresh =
        idList === '' ? [] : idList.split(',').filter((id) => !asked.has(id))
    if (fresh.length > 0) {
        setBatches([...batches, fresh])
    }

    const orgUnitNames = useQueries({
        queries: batches.map((ids) => ({
            queryKey: timelineKeys.orgUnitNames(ids),
            staleTime: Infinity,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            queryFn: async ({ signal }: { signal: AbortSignal }) => {
                const result = await fetchOrgUnitNames(client, { ids }, signal)
                if (Result.isError(result)) {
                    throw result.error
                }
                return result.value
            },
        })),
        combine: combineNames,
    })

    const metadata = metadataQuery.data
    const stages = useMemo(
        () => (metadata ? toStages(metadata) : NO_STAGES),
        [metadata]
    )
    const attributes = useMemo(
        () => (metadata ? toAttributes(metadata) : NO_VALUES),
        [metadata]
    )

    const status: TimelineDhis2Value['status'] = metadata
        ? 'success'
        : metadataQuery.error
          ? 'error'
          : 'loading'
    const error = metadataQuery.error ?? undefined

    const value = useMemo<TimelineDhis2Value>(
        () => ({ status, error, stages, attributes, orgUnitNames }),
        [status, error, stages, attributes, orgUnitNames]
    )

    return (
        <TimelineDhis2Context.Provider value={value}>
            {children}
        </TimelineDhis2Context.Provider>
    )
}

export const useTimelineDhis2 = (): TimelineDhis2Value => {
    const context = useContext(TimelineDhis2Context)
    if (context === null) {
        throw new Error(
            'useTimelineDhis2 must be used within TimelineDhis2Provider.'
        )
    }
    return context
}
