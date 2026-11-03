const ROOT = 'observation-cards'

export const observationQueryKeys = {
    programMetadata: (programId: string) =>
        [ROOT, 'programMetadata', programId] as const,
    events: (trackedEntityId: string, programId: string) =>
        [ROOT, 'events', trackedEntityId, programId] as const,
    enrollments: (trackedEntityId: string, programId: string) =>
        [ROOT, 'enrollments', trackedEntityId, programId] as const,
}
