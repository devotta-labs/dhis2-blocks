import type { EventTimeField } from './queries'

const root = ['timeline'] as const

/**
 * React Query keys for every timeline request. All start with `root`, so
 * `queryClient.invalidateQueries({ queryKey: timelineKeys.root })` refreshes
 * every history after the host edits data elsewhere.
 */
export const timelineKeys = {
    root,
    trackedEntity: (trackedEntity: string) =>
        [...root, 'trackedEntity', trackedEntity] as const,
    events: (
        trackedEntity: string,
        program: string,
        timeField: EventTimeField,
        cap: number
    ) => [...root, 'events', trackedEntity, program, timeField, cap] as const,
    attributeChangeLog: (
        trackedEntity: string,
        program: string,
        maxRows: number
    ) =>
        [
            ...root,
            'attributeChangeLog',
            trackedEntity,
            program,
            maxRows,
        ] as const,
    eventChangeLog: (event: string) =>
        [...root, 'eventChangeLog', event] as const,
    programMetadata: (program: string) =>
        [...root, 'programMetadata', program] as const,
    orgUnitNames: (sortedIds: ReadonlyArray<string>) =>
        [...root, 'orgUnitNames', sortedIds] as const,
}
