import type { ProfileWidgetClient, QueryParameters } from './client'
import {
    MeAuthoritiesSchema,
    ProgramMetadataSchema,
    SYSTEM_INFO_FIELDS,
    SystemInfoSchema,
    TRACKED_ENTITY_PROFILE_FIELDS,
    TRACKED_ENTITY_UPDATE_FIELDS,
    TrackedEntityForUpdateSchema,
    TrackedEntityRecordSchema,
    TrackedEntityTypeMetadataSchema,
    programMetadataFields,
    trackedEntityTypeMetadataFields,
} from './schemas'
import type { ProfileServerFeatures } from './serverVersion'

/*
 * Plain request functions shared by the data, action and changelog hooks.
 * They validate the response and throw the raw failure; callers map it with
 * the `to*Error` helpers in ./client.
 */

export const fetchProgramMetadata = (
    client: ProfileWidgetClient,
    input: { programId: string; features: ProfileServerFeatures },
    signal?: AbortSignal
) =>
    client.query(
        {
            resource: 'programs',
            id: input.programId,
            params: { fields: programMetadataFields(input.features) },
        },
        ProgramMetadataSchema,
        signal
    )

export const fetchTrackedEntityTypeMetadata = (
    client: ProfileWidgetClient,
    input: { trackedEntityTypeId: string; features: ProfileServerFeatures },
    signal?: AbortSignal
) =>
    client.query(
        {
            resource: 'trackedEntityTypes',
            id: input.trackedEntityTypeId,
            params: { fields: trackedEntityTypeMetadataFields(input.features) },
        },
        TrackedEntityTypeMetadataSchema,
        signal
    )

/** With a program, attributes are TET ∪ program; without, TET only. */
export const fetchTrackedEntityRecord = (
    client: ProfileWidgetClient,
    input: { trackedEntityId: string; programId: string | null },
    signal?: AbortSignal
) =>
    client.query(
        {
            resource: 'tracker/trackedEntities',
            id: input.trackedEntityId,
            params: {
                fields: TRACKED_ENTITY_PROFILE_FIELDS,
                // app-runtime drops undefined parameters
                program: input.programId ?? undefined,
            },
        },
        TrackedEntityRecordSchema,
        signal
    )

/** The fields a tracker UPDATE would otherwise wipe. */
export const fetchTrackedEntityForUpdate = (
    client: ProfileWidgetClient,
    input: { trackedEntityId: string },
    signal?: AbortSignal
) =>
    client.query(
        {
            resource: 'tracker/trackedEntities',
            id: input.trackedEntityId,
            params: { fields: TRACKED_ENTITY_UPDATE_FIELDS },
        },
        TrackedEntityForUpdateSchema,
        signal
    )

export const fetchSystemInfo = (
    client: ProfileWidgetClient,
    signal?: AbortSignal
) =>
    client.query(
        { resource: 'system/info', params: { fields: SYSTEM_INFO_FIELDS } },
        SystemInfoSchema,
        signal
    )

export const fetchAuthorities = async (
    client: ProfileWidgetClient,
    signal?: AbortSignal
): Promise<readonly string[]> =>
    (
        await client.query(
            { resource: 'me', params: { fields: 'authorities' } },
            MeAuthoritiesSchema,
            signal
        )
    ).authorities

/* -------------------------------- URLs ------------------------------------ */

/** The API path of one tracked-entity attribute's file or image. */
export const trackedEntityAttributeFileEndpoint = (
    trackedEntityId: string,
    attributeId: string
) => `tracker/trackedEntities/${trackedEntityId}/attributes/${attributeId}`

/**
 * An href for an API path, from `useConfig()`'s `baseUrl` and `apiVersion`.
 * A relative `baseUrl` (e.g. `..`) gives a relative href, which the browser
 * resolves against the app's own location.
 */
export const buildApiHref = (
    config: { baseUrl: string; apiVersion: number },
    path: string,
    params: QueryParameters = {}
) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue
        search.set(key, String(value))
    }
    const query = search.toString()
    return `${config.baseUrl.replace(/\/+$/, '')}/api/${config.apiVersion}/${path.replace(/^\/+/, '')}${query ? `?${query}` : ''}`
}
