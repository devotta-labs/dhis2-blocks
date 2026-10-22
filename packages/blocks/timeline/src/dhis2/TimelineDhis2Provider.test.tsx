import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import type { TimelineEntry } from '../core/types'
import {
    actionsOf,
    META,
    source,
    TODAY,
} from '../ui/__fixtures__/timelineFixtures'
import { buildTimelineState, TimelineProvider } from '../ui/TimelineContext'
import v43Metadata from './__fixtures__/v43/program-metadata.json'
import v43Names from './__fixtures__/v43/org-unit-names.json'
import {
    TimelineDhis2Provider,
    useTimelineDhis2,
} from './TimelineDhis2Provider'

const GROUP_OPTIONS = {
    order: META.order,
    groupBy: 'day',
    today: TODAY,
    calendar: META.calendar,
    locale: META.locale,
    labels: { overdue: 'Overdue', undated: 'Undated', allEntries: 'All' },
} as const

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

const eventEntry = (id: string, orgUnit?: string): TimelineEntry<unknown> => ({
    id: `events:${id}`,
    at: '2026-05-05T00:00:00.000',
    sourceKey: 'events',
    data: { event: { event: id, orgUnit }, status: 'completed' },
})

const otherEntry: TimelineEntry<unknown> = {
    id: 'x:1',
    at: '2026-05-05T00:00:00.000',
    sourceKey: 'other',
    data: { event: { orgUnit: 'ignored' } },
}

const setup = (names: Record<string, string> = {}) => {
    const nameRequests: string[][] = []
    let metadataRequests = 0
    const data: CustomData = {
        programs: async () => {
            metadataRequests++
            return JSON.parse(JSON.stringify(v43Metadata))
        },
        organisationUnits: async (_type, query) => {
            const filter = String(query.params?.filter)
            const ids = filter.slice('id:in:['.length, -1).split(',')
            nameRequests.push(ids)
            return {
                organisationUnits: ids.flatMap((id) =>
                    names[id] === undefined
                        ? []
                        : [{ id, displayName: names[id] }]
                ),
            }
        },
    }
    const queryClient = new QueryClient()
    // The feed the timeline holds; a rerender picks up a changed value.
    const feed = { entries: new Array<TimelineEntry<unknown>>() }
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                <TimelineProvider
                    state={buildTimelineState<unknown>(
                        {
                            entries: feed.entries,
                            status: 'ready',
                            sources: [source('events', 'complete')],
                            hasMore: false,
                            loadingMore: false,
                            loadMore: () => undefined,
                            retry: () => undefined,
                        },
                        GROUP_OPTIONS
                    )}
                    actions={actionsOf()}
                    meta={META}
                >
                    <TimelineDhis2Provider program="WSGAb5XwJ3Y">
                        {children}
                    </TimelineDhis2Provider>
                </TimelineProvider>
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return {
        feed,
        nameRequests,
        metadataRequests: () => metadataRequests,
        wrapper,
    }
}

describe('TimelineDhis2Provider', () => {
    it('maps stages with names, hideDueDate and displayInReports elements in stage order', async () => {
        const { wrapper } = setup()
        const { result } = await renderHook(() => useTimelineDhis2(), {
            wrapper,
        })
        await expect.poll(() => result.current.status).toBe('success')

        const stages = [...result.current.stages.values()]
        expect(stages.map((s) => s.name)).toEqual(
            v43Metadata.programStages.map((s) => s.displayName)
        )
        const raw = v43Metadata.programStages.find(
            (s) =>
                s.programStageDataElements.some((e) => e.displayInReports) &&
                s.programStageDataElements.some((e) => !e.displayInReports)
        )
        if (raw === undefined) throw new Error('fixture has no mixed stage')
        const stage = result.current.stages.get(raw.id)
        expect(stage?.hideDueDate).toBe(raw.hideDueDate)
        const flagged = raw.programStageDataElements.filter(
            (e) => e.displayInReports
        )
        expect(flagged.length).toBeGreaterThan(0)
        expect(flagged.length).toBeLessThan(raw.programStageDataElements.length)
        expect(stage?.reportDataElementIds).toEqual(
            flagged.map((e) => e.dataElement.id)
        )
        // Every element of the stage is known, flagged or not.
        expect(stage?.dataElements.size).toBe(
            raw.programStageDataElements.length
        )
        const first = flagged[0].dataElement
        expect(stage?.dataElements.get(first.id)).toEqual({
            name: first.displayFormName ?? first.displayName,
            meta: { valueType: first.valueType, optionSet: first.optionSet },
        })
    })

    it('maps program attributes with value type and options', async () => {
        const { wrapper } = setup()
        const { result } = await renderHook(() => useTimelineDhis2(), {
            wrapper,
        })
        await expect.poll(() => result.current.status).toBe('success')

        const raw = v43Metadata.programTrackedEntityAttributes.map(
            (a) => a.trackedEntityAttribute
        )
        expect(result.current.attributes.size).toBe(raw.length)
        const withOptions = raw.find((a) => a.optionSet)
        const attribute = raw[0]
        expect(
            result.current.attributes.get(attribute.id)?.meta.valueType
        ).toBe(attribute.valueType)
        if (withOptions) {
            expect(
                result.current.attributes.get(withOptions.id)?.meta.optionSet
                    ?.options
            ).toEqual(withOptions.optionSet?.options)
        }
    })

    it('fetches org unit names once for all ids in the feed, and again only for new ids after load more', async () => {
        const names = Object.fromEntries(
            v43Names.organisationUnits.map((o) => [o.id, o.displayName])
        )
        names.NewOrgUnit1 = 'Later Clinic'
        const { wrapper, nameRequests, feed } = setup(names)
        feed.entries = [
            eventEntry('e1', 'ImspTQPwCqd'),
            eventEntry('e2', 'DiszpKrYNg8'),
            eventEntry('e3', 'DiszpKrYNg8'),
            eventEntry('e4'),
            otherEntry,
        ]
        const { result, rerender } = await renderHook(
            () => useTimelineDhis2(),
            { wrapper }
        )
        await expect
            .poll(() => result.current.orgUnitNames.get('DiszpKrYNg8'))
            .toBe('Ngelehun CHC')
        expect(result.current.orgUnitNames.get('ImspTQPwCqd')).toBe(
            'Sierra Leone'
        )
        expect(nameRequests).toEqual([['DiszpKrYNg8', 'ImspTQPwCqd']])

        // Load more: one known id, one new.
        feed.entries = [
            ...feed.entries,
            eventEntry('e5', 'DiszpKrYNg8'),
            eventEntry('e6', 'NewOrgUnit1'),
        ]
        await rerender()
        await expect
            .poll(() => result.current.orgUnitNames.get('NewOrgUnit1'))
            .toBe('Later Clinic')
        expect(nameRequests).toEqual([
            ['DiszpKrYNg8', 'ImspTQPwCqd'],
            ['NewOrgUnit1'],
        ])
        // Earlier names are kept.
        expect(result.current.orgUnitNames.get('ImspTQPwCqd')).toBe(
            'Sierra Leone'
        )
    })

    it('throws a clear error when useTimelineDhis2 is used outside the provider', async () => {
        await expect(renderHook(() => useTimelineDhis2())).rejects.toThrow(
            'useTimelineDhis2 must be used within TimelineDhis2Provider.'
        )
    })
})
