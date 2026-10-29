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

const SET_INACTIVE_OPERATION = 'set tracked entity inactive'
const DELETE_OPERATION = 'delete tracked entity'

type TrackerImportStrategy = 'UPDATE' | 'DELETE'

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

const buildSetInactivePayload = (
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
