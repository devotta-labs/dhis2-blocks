import type { EventTimeField } from './queries'

const root = ['timeline'] as const

/**
 * React Query keys for every timeline request. All start with `root`, so
 * `queryClient.invalidateQueries({ queryKey: timelineKeys.root })` refreshes
 * the whole timeline after the host edits data elsewhere.
 */
export const timelineKeys = {
    root,
    events: (
        trackedEntity: string,
        program: string,
        timeField: EventTimeField
    ) => [...root, 'events', trackedEntity, program, timeField] as const,
    trackedEntity: (trackedEntity: string, program: string) =>
        [...root, 'trackedEntity', trackedEntity, program] as const,
    attributeChangeLog: (trackedEntity: string, program: string) =>
        [...root, 'attributeChangeLog', trackedEntity, program] as const,
    eventChangeLog: (event: string) =>
        [...root, 'eventChangeLog', event] as const,
    programMetadata: (program: string) =>
        [...root, 'programMetadata', program] as const,
    orgUnitNames: (sortedIds: ReadonlyArray<string>) =>
        [...root, 'orgUnitNames', sortedIds] as const,
}
