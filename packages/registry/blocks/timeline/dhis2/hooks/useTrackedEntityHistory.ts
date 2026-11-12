import { useDataEngine } from '@dhis2/app-runtime'
import {
    useQueries,
    useQuery,
    type UseQueryResult,
} from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { localDay } from '../../core/today'
import {
    buildHistory,
    hasFirstAnswers,
    orgUnitsToName,
    toAnswer,
    type Answer,
    type History,
    type ProgramAnswers,
} from '../buildHistory'
import {
    fetchAttributeChangeLog,
    fetchEvents,
    fetchTrackedEntity,
    shouldRetryRequest,
    type ChangeLogResult,
    type EventsResult,
    type EventTimeField,
} from '../queries'
import { timelineKeys } from '../timelineKeys'
import type { ProgramInfo } from '../types'
import { useOrgUnitNames } from './useOrgUnitNames'
import { programInfoQuery } from './useProgramInfo'

export interface TrackedEntityHistoryOptions {
    trackedEntity: string
    /** Defaults to every program the tracked entity is enrolled in. */
    programs?: ReadonlyArray<string>
    /** Where a past event sits: there is no default, since programs differ. */
    timeField: EventTimeField
    /** Most events read per program; past it a notice says so. */
    cap?: number
    /** The current moment; for tests. */
    now?: Date
}

export interface TrackedEntityHistory extends History {
    isFetching: boolean
    /** Asks again for the enrollments, the events and the attribute changes. */
    refetch(): void
}

/**
 * The `combine` of a `useQueries`. TanStack Query shares the parts of its
 * result that haven't changed, so `answers` and each answer in it keep their
 * references until one changes, and can be memo deps.
 */
const summarize = <T>(queries: ReadonlyArray<UseQueryResult<T>>) => ({
    answers: queries.map(toAnswer),
    isFetching: queries.some((query) => query.isFetching),
})

/** `toAnswer(query)`, the same object until the answer changes. */
const useAnswer = <T>(query: UseQueryResult<T>): Answer<T> => {
    const { data, pending, failed, refetch } = toAnswer(query)
    return useMemo(
        () => ({ data, pending, failed, refetch }),
        [data, pending, failed, refetch]
    )
}

/**
 * A person's history: events, enrollment milestones and notes, and attribute
 * changes, in every program they are enrolled in (or `programs`). One tracked
 * entity request; per program one request each for its events (2.43 requires
 * `program`), its metadata and its attribute changelog; then one request for
 * the org unit names. `buildHistory` says what shows when.
 */
export const useTrackedEntityHistory = ({
    trackedEntity,
    programs: given,
    timeField,
    cap = 500,
    now,
}: TrackedEntityHistoryOptions): TrackedEntityHistory => {
    const engine = useDataEngine()
    const entity = useQuery({
        queryKey: timelineKeys.trackedEntity(trackedEntity),
        retry: shouldRetryRequest,
        queryFn: ({ signal }) =>
            fetchTrackedEntity(engine, { trackedEntity }, signal),
    })

    // As strings, so a new array of the same programs changes nothing.
    const givenKey = given?.join(',')
    const enrolledKey = entity.data?.enrollments
        .map((enrollment) => enrollment.program)
        .join(',')
    const programIds = useMemo(() => {
        const key = givenKey ?? enrolledKey
        if (key === undefined) {
            return undefined
        }
        return [...new Set(key === '' ? [] : key.split(','))].sort()
    }, [givenKey, enrolledKey])

    const info = useQueries({
        queries: (programIds ?? []).map((program) =>
            programInfoQuery(engine, program)
        ),
        combine: summarize<ProgramInfo>,
    })
    const events = useQueries({
        queries: (programIds ?? []).map((program) => ({
            queryKey: timelineKeys.events(
                trackedEntity,
                program,
                timeField,
                cap
            ),
            retry: shouldRetryRequest,
            queryFn: ({ signal }: { signal: AbortSignal }) =>
                fetchEvents(
                    engine,
                    { trackedEntity, program, timeField, cap },
                    signal
                ),
        })),
        combine: summarize<EventsResult>,
    })
    const changes = useQueries({
        queries: (programIds ?? []).map((program) => ({
            queryKey: timelineKeys.attributeChangeLog(trackedEntity, program),
            // A failure shows its notice and Retry at once.
            retry: false,
            queryFn: ({ signal }: { signal: AbortSignal }) =>
                fetchAttributeChangeLog(
                    engine,
                    { trackedEntity, program },
                    signal
                ),
        })),
        combine: summarize<ChangeLogResult>,
    })
    const programs = useMemo(
        () =>
            programIds?.map((id, index): ProgramAnswers => ({
                id,
                info: info.answers[index],
                events: events.answers[index],
                changes: changes.answers[index],
            })),
        [programIds, info.answers, events.answers, changes.answers]
    )

    const subject = [trackedEntity, givenKey, timeField, cap].join('|')
    const [shownFor, setShownFor] = useState<string>()
    const shown = shownFor === subject

    // Names are asked for once, after the first answers; later sets (a new
    // program, a new org unit) keep the known names on show while they load.
    const orgUnitIds = useMemo(() => orgUnitsToName(programs), [programs])
    const names = useOrgUnitNames(orgUnitIds, {
        enabled: shown || hasFirstAnswers(programs),
    })

    const entityAnswer = useAnswer(entity)
    const namesAnswer = useAnswer(names)
    const today = localDay(now ?? new Date())
    const history = useMemo(
        () =>
            buildHistory({
                trackedEntity: entityAnswer,
                programs,
                orgUnitNames: namesAnswer,
                shown,
                timeField,
                cap,
                today,
            }),
        [entityAnswer, programs, namesAnswer, shown, timeField, cap, today]
    )
    // Adjusting state while rendering, as React documents for derived state.
    if (!shown && !history.isPending && !history.isError) {
        setShownFor(subject)
    }

    return {
        ...history,
        isFetching:
            entity.isFetching ||
            info.isFetching ||
            events.isFetching ||
            changes.isFetching ||
            names.isFetching,
        refetch: () => {
            entityAnswer.refetch()
            for (const program of programs ?? []) {
                program.events.refetch()
                program.changes.refetch()
            }
        },
    }
}
