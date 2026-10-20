const ROOT = 'observation-cards'

export const observationQueryKeys = {
    stages: (programId: string) => [ROOT, 'stages', programId] as const,
    dataElements: (sortedIds: ReadonlyArray<string>) =>
        [ROOT, 'dataElements', sortedIds] as const,
    events: (trackedEntityId: string, programId: string) =>
        [ROOT, 'events', trackedEntityId, programId] as const,
}
