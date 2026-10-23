/*
 * Runs in the browser project because the failure cases throw app-runtime's
 * real FetchError, and @dhis2/app-runtime reads `localStorage` when imported.
 * Everything else here is plain functions over a fake engine.
 */
import { FetchError } from '@dhis2/app-runtime'
import {
    createProfileWidgetClient,
    type DataEngineLike,
    type DataEngineValue,
    type ProfileWidgetMutationRequest,
    type ProfileWidgetQueryRequest,
} from '../../api/client'
import { TRACKED_ENTITY_UPDATE_FIELDS } from '../../api/schemas'
import { ProfileWidgetRequestError, TrackerImportError } from '../../errors'
import {
    buildSetInactivePayload,
    deleteTrackedEntity,
    setTrackedEntityInactive,
} from '../trackerImport'

const NOW = new Date('2026-10-23T12:34:56.789Z')

const currentRecord = {
    trackedEntity: 'TrackedEnt1',
    trackedEntityType: 'nEenWmSyUEp',
    orgUnit: 'DiszpKrYNg8',
    inactive: false,
    geometry: { type: 'Point', coordinates: [-11.4197, 8.1039] },
    potentialDuplicate: true,
    createdAtClient: '2020-01-02T03:04:05.678',
    updatedAtClient: '2021-01-02T03:04:05.678',
}

const okReport = {
    status: 'OK',
    validationReport: { errorReports: [], warningReports: [] },
    stats: { created: 0, updated: 1, deleted: 0, ignored: 0, total: 1 },
}

const rejectedReport = {
    status: 'ERROR',
    validationReport: {
        errorReports: [
            {
                message: 'User has no write access to TrackedEntityType',
                errorCode: 'E1001',
                trackerType: 'TRACKED_ENTITY',
                uid: 'TrackedEnt1',
            },
            {
                message: 'Second report for the same entity',
                errorCode: 'E1000',
                trackerType: 'TRACKED_ENTITY',
                uid: 'TrackedEnt1',
            },
        ],
        warningReports: [],
    },
}

interface FakeEngineOptions {
    record?: DataEngineValue
    readFailure?: Error
    mutateResult?: DataEngineValue
    mutateFailure?: Error
}

const createFakeEngine = (options: FakeEngineOptions = {}) => {
    const queries: ProfileWidgetQueryRequest[] = []
    const mutations: ProfileWidgetMutationRequest[] = []
    const engine: DataEngineLike = {
        query: async (query) => {
            queries.push(...Object.values(query))
            if (options.readFailure) throw options.readFailure
            return {
                profileWidgetResource: options.record ?? currentRecord,
            }
        },
        mutate: async (mutation) => {
            mutations.push(mutation)
            if (options.mutateFailure) throw options.mutateFailure
            return options.mutateResult ?? okReport
        },
    }
    return { client: createProfileWidgetClient(engine), queries, mutations }
}

describe('buildSetInactivePayload', () => {
    it('echoes the fields a tracker UPDATE would otherwise overwrite', () => {
        expect(
            buildSetInactivePayload(currentRecord, true, NOW.toISOString())
        ).toEqual({
            trackedEntities: [
                {
                    trackedEntity: 'TrackedEnt1',
                    trackedEntityType: 'nEenWmSyUEp',
                    orgUnit: 'DiszpKrYNg8',
                    inactive: true,
                    geometry: currentRecord.geometry,
                    potentialDuplicate: true,
                    createdAtClient: '2020-01-02T03:04:05.678',
                    updatedAtClient: '2026-10-23T12:34:56.789Z',
                },
            ],
        })
    })

    it('sends the server defaults for fields DHIS2 omitted because they are unset', () => {
        const payload = buildSetInactivePayload(
            {
                trackedEntity: 'TrackedEnt1',
                trackedEntityType: 'nEenWmSyUEp',
                orgUnit: 'DiszpKrYNg8',
                inactive: true,
            },
            false,
            NOW.toISOString()
        )
        expect(payload.trackedEntities[0]).toMatchObject({
            inactive: false,
            geometry: null,
            potentialDuplicate: false,
        })
        expect(JSON.parse(JSON.stringify(payload))).toEqual({
            trackedEntities: [
                {
                    trackedEntity: 'TrackedEnt1',
                    trackedEntityType: 'nEenWmSyUEp',
                    orgUnit: 'DiszpKrYNg8',
                    inactive: false,
                    geometry: null,
                    potentialDuplicate: false,
                    updatedAtClient: '2026-10-23T12:34:56.789Z',
                },
            ],
        })
    })
})

describe('setTrackedEntityInactive', () => {
    it('re-reads the entity without program scope, then posts a synchronous UPDATE', async () => {
        const { client, queries, mutations } = createFakeEngine()

        const result = await setTrackedEntityInactive(
            client,
            { trackedEntityId: 'TrackedEnt1', inactive: true },
            () => NOW
        )

        expect(result.isOk()).toBe(true)
        expect(queries).toEqual([
            {
                resource: 'tracker/trackedEntities',
                id: 'TrackedEnt1',
                params: { fields: TRACKED_ENTITY_UPDATE_FIELDS },
            },
        ])
        expect(mutations).toEqual([
            {
                resource: 'tracker',
                type: 'create',
                params: { async: false, importStrategy: 'UPDATE' },
                data: buildSetInactivePayload(
                    currentRecord,
                    true,
                    NOW.toISOString()
                ),
            },
        ])
    })

    it('accepts an import that only produced warnings', async () => {
        const { client } = createFakeEngine({
            mutateResult: {
                status: 'WARNING',
                validationReport: {
                    errorReports: [],
                    warningReports: [{ message: 'Heads up' }],
                },
            },
        })

        const result = await setTrackedEntityInactive(client, {
            trackedEntityId: 'TrackedEnt1',
            inactive: false,
        })

        expect(result.isOk()).toBe(true)
    })

    it('maps a 409 import report thrown by app-runtime to TrackerImportError', async () => {
        const { client } = createFakeEngine({
            mutateFailure: new FetchError({
                type: 'access',
                message: 'Forbidden',
                details: rejectedReport,
            }),
        })

        const result = await setTrackedEntityInactive(client, {
            trackedEntityId: 'TrackedEnt1',
            inactive: true,
        })

        expect(result.isErr()).toBe(true)
        const error = result.isErr() ? result.error : null
        expect(error).toBeInstanceOf(TrackerImportError)
        expect(
            error instanceof TrackerImportError
                ? error.errorReports.map((report) => report.message)
                : []
        ).toEqual([
            'User has no write access to TrackedEntityType',
            'Second report for the same entity',
        ])
    })

    it('rejects a 2xx report whose status is ERROR', async () => {
        const { client } = createFakeEngine({ mutateResult: rejectedReport })

        const result = await setTrackedEntityInactive(client, {
            trackedEntityId: 'TrackedEnt1',
            inactive: true,
        })

        const error = result.isErr() ? result.error : null
        expect(error).toBeInstanceOf(TrackerImportError)
        expect(
            error instanceof TrackerImportError ? error.errorReports : []
        ).toHaveLength(2)
    })

    it('does not post when the re-read fails, and keeps the HTTP status', async () => {
        const { client, mutations } = createFakeEngine({
            readFailure: new FetchError({
                type: 'unknown',
                message: 'Not found',
                details: { httpStatusCode: 404, message: 'Not found' },
            }),
        })

        const result = await setTrackedEntityInactive(client, {
            trackedEntityId: 'TrackedEnt1',
            inactive: true,
        })

        const error = result.isErr() ? result.error : null
        expect(error).toBeInstanceOf(ProfileWidgetRequestError)
        expect(
            error instanceof ProfileWidgetRequestError
                ? error.httpStatus
                : undefined
        ).toBe(404)
        expect(mutations).toHaveLength(0)
    })

    it('reports a malformed re-read as a request error without posting', async () => {
        const { client, mutations } = createFakeEngine({
            record: { trackedEntity: 'TrackedEnt1' },
        })

        const result = await setTrackedEntityInactive(client, {
            trackedEntityId: 'TrackedEnt1',
            inactive: true,
        })

        expect(result.isErr() ? result.error : null).toBeInstanceOf(
            ProfileWidgetRequestError
        )
        expect(mutations).toHaveLength(0)
    })

    it('maps a network failure on the import to ProfileWidgetRequestError', async () => {
        const { client } = createFakeEngine({
            mutateFailure: new FetchError({
                type: 'network',
                message: 'An unknown network error occurred',
            }),
        })

        const result = await setTrackedEntityInactive(client, {
            trackedEntityId: 'TrackedEnt1',
            inactive: true,
        })

        const error = result.isErr() ? result.error : null
        expect(error).toBeInstanceOf(ProfileWidgetRequestError)
        expect(error?.operation).toBe('set tracked entity inactive')
    })
})

describe('deleteTrackedEntity', () => {
    it('posts a synchronous DELETE with only the entity id', async () => {
        const { client, queries, mutations } = createFakeEngine()

        const result = await deleteTrackedEntity(client, 'TrackedEnt1')

        expect(result.isOk()).toBe(true)
        expect(queries).toHaveLength(0)
        expect(mutations).toEqual([
            {
                resource: 'tracker',
                type: 'create',
                params: { async: false, importStrategy: 'DELETE' },
                data: { trackedEntities: [{ trackedEntity: 'TrackedEnt1' }] },
            },
        ])
    })

    it('maps tracker error reports to TrackerImportError', async () => {
        const { client } = createFakeEngine({
            mutateFailure: new FetchError({
                type: 'access',
                message: 'Forbidden',
                details: {
                    status: 'ERROR',
                    validationReport: {
                        errorReports: [
                            {
                                message:
                                    'Tracked entity has enrollments; F_TEI_CASCADE_DELETE is required',
                                errorCode: 'E1100',
                                trackerType: 'TRACKED_ENTITY',
                                uid: 'TrackedEnt1',
                            },
                        ],
                    },
                },
            }),
        })

        const result = await deleteTrackedEntity(client, 'TrackedEnt1')

        const error = result.isErr() ? result.error : null
        expect(error).toBeInstanceOf(TrackerImportError)
        expect(error?.operation).toBe('delete tracked entity')
    })

    it('maps a server error to ProfileWidgetRequestError with its status', async () => {
        const { client } = createFakeEngine({
            mutateFailure: new FetchError({
                type: 'unknown',
                message: 'An unknown error occurred - (500)',
                details: { httpStatusCode: 500 },
            }),
        })

        const result = await deleteTrackedEntity(client, 'TrackedEnt1')

        const error = result.isErr() ? result.error : null
        expect(error).toBeInstanceOf(ProfileWidgetRequestError)
        expect(
            error instanceof ProfileWidgetRequestError
                ? error.httpStatus
                : undefined
        ).toBe(500)
    })
})
