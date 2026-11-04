const ROOT = 'observation-cards'

/** Every key starts with the client's cache id, so two data engines never share results. */
export const observationQueryKeys = {
    programMetadata: (clientId: number, programId: string) =>
        [ROOT, clientId, 'programMetadata', programId] as const,
    events: (clientId: number, trackedEntityId: string, programId: string) =>
        [ROOT, clientId, 'events', trackedEntityId, programId] as const,
    enrollments: (
        clientId: number,
        trackedEntityId: string,
        programId: string
    ) => [ROOT, clientId, 'enrollments', trackedEntityId, programId] as const,
}
