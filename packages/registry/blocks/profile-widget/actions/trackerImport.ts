import { Result } from 'better-result'
import { toProfileMutationError, type ProfileWidgetClient } from '../api/client'
import { fetchTrackedEntityForUpdate } from '../api/requests'
import {
    TrackerImportReportSchema,
    type ApiTrackedEntityForUpdate,
    type TrackerImportPayload,
} from '../api/schemas'
import { TrackerImportError } from '../errors'
import type {
    ProfileMutationError,
    SetTrackedEntityInactiveInput,
} from '../types'

/*
 * The block's two tracker imports. Both are plain functions over a
 * `ProfileWidgetClient`, so tests inject a fake engine through
 * `createProfileWidgetClient`; the hooks only add TanStack Query state and
 * cache updates.
 */

const SET_INACTIVE_OPERATION = 'set tracked entity inactive'
const DELETE_OPERATION = 'delete tracked entity'

type TrackerImportStrategy = 'UPDATE' | 'DELETE'

/**
 * `POST tracker?async=false&importStrategy=…`. DHIS2 answers a rejected
 * synchronous import with 409 and the report as the body, which app-runtime
 * throws; a report with status ERROR in a 2xx body is rejected here too.
 * Throws the raw failure; callers map it with `toProfileMutationError`.
 */
const postTrackerImport = async (
    client: ProfileWidgetClient,
    importStrategy: TrackerImportStrategy,
    payload: TrackerImportPayload,
    operation: string
): Promise<void> => {
    const report = await client.mutate(
        {
            resource: 'tracker',
            type: 'create',
            params: { async: false, importStrategy },
            data: payload,
        },
        TrackerImportReportSchema
    )
    if (report.status === 'ERROR') {
        throw new TrackerImportError({
            operation,
            message: `${operation}: the tracker import was rejected`,
            errorReports: report.validationReport?.errorReports ?? [],
            cause: report,
        })
    }
}

/**
 * The UPDATE body for a status change. A tracker UPDATE overwrites
 * `geometry`, `potentialDuplicate`, `createdAtClient` and `updatedAtClient`
 * with whatever the payload holds (`TrackerObjectsMapper.map`), so the current
 * values are echoed back; only `inactive` and `updatedAtClient` change.
 * Attributes are left out: the importer only touches attributes it is sent.
 */
export const buildSetInactivePayload = (
    current: ApiTrackedEntityForUpdate,
    inactive: boolean,
    updatedAtClient: string
): TrackerImportPayload => ({
    trackedEntities: [
        {
            trackedEntity: current.trackedEntity,
            trackedEntityType: current.trackedEntityType,
            orgUnit: current.orgUnit,
            inactive,
            geometry: current.geometry ?? null,
            potentialDuplicate: current.potentialDuplicate ?? false,
            createdAtClient: current.createdAtClient,
            updatedAtClient,
        },
    ],
})

/**
 * Re-reads the entity and posts the status change.
 *
 * The re-read is deliberately not program-scoped. The importer's ownership
 * check (`DefaultTrackerAccessManager.canUpdate`) looks across every tracker
 * program of the type the user can write, never at one program, and a
 * program-scoped read would additionally 404 for an entity that has no
 * enrollment in that program. An unscoped read uses the same
 * any-accessible-program ownership rule as the import.
 */
export const setTrackedEntityInactive = async (
    client: ProfileWidgetClient,
    input: SetTrackedEntityInactiveInput,
    now: () => Date = () => new Date()
): Promise<Result<void, ProfileMutationError>> => {
    try {
        const current = await fetchTrackedEntityForUpdate(client, {
            trackedEntityId: input.trackedEntityId,
        })
        await postTrackerImport(
            client,
            'UPDATE',
            buildSetInactivePayload(
                current,
                input.inactive,
                now().toISOString()
            ),
            SET_INACTIVE_OPERATION
        )
        return Result.ok()
    } catch (cause) {
        return Result.err(toProfileMutationError(cause, SET_INACTIVE_OPERATION))
    }
}

/**
 * `POST tracker?async=false&importStrategy=DELETE`. The server cascades to
 * enrollments, events and relationships and offers no undelete.
 */
export const deleteTrackedEntity = async (
    client: ProfileWidgetClient,
    trackedEntityId: string
): Promise<Result<void, ProfileMutationError>> => {
    try {
        await postTrackerImport(
            client,
            'DELETE',
            { trackedEntities: [{ trackedEntity: trackedEntityId }] },
            DELETE_OPERATION
        )
        return Result.ok()
    } catch (cause) {
        return Result.err(toProfileMutationError(cause, DELETE_OPERATION))
    }
}
