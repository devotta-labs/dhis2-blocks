const ROOT = 'tracked-entity-header'

/** Every key starts with the client's cache id, so two data engines never share results. */
export const trackedEntityHeaderQueryKeys = {
    trackedEntity: (
        clientId: number,
        trackedEntity: string,
        program?: string
    ) =>
        [
            ROOT,
            clientId,
            'trackedEntity',
            trackedEntity,
            program ?? '',
        ] as const,
    attributeMetadata: (clientId: number, subject: string | { type: string }) =>
        [ROOT, clientId, 'attributeMetadata', subject] as const,
    orgUnit: (clientId: number, id: string) =>
        [ROOT, clientId, 'orgUnit', id] as const,
}

/** Metadata and org unit names change rarely; a record is always asked for fresh. */
export const METADATA_STALE_TIME = 60 * 60_000
