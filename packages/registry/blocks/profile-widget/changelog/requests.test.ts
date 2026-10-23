import { ZodError } from 'zod'
import {
    createProfileWidgetClient,
    type DataEngineLike,
    type DataEngineValue,
    type ProfileWidgetQueryRequest,
} from '../api/client'
import { resolveServerFeatures } from '../api/serverVersion'
import {
    changelogQueryParameters,
    fetchTrackedEntityChangelog,
    resolveChangelogRequest,
} from './requests'

const v41 = resolveServerFeatures({ serverVersion: { major: 2, minor: 41 } })
const v42 = resolveServerFeatures({ serverVersion: { major: 2, minor: 42 } })

const fakeEngine = (response: DataEngineValue) => {
    const requests: ProfileWidgetQueryRequest[] = []
    const engine: DataEngineLike = {
        query: async (query) => {
            requests.push(...Object.values(query))
            return Object.fromEntries(
                Object.keys(query).map((key) => [key, response])
            )
        },
        mutate: async () => null,
    }
    return { engine, requests }
}

describe('resolveChangelogRequest', () => {
    const input = {
        trackedEntityId: 'TrackedEnt1',
        programId: 'Program0001',
        page: 2,
        pageSize: 10,
        attributeId: 'Attribute01',
        order: { column: 'username', direction: 'asc' },
    } as const

    it('keeps the filter and every order column on 2.42+', () => {
        expect(resolveChangelogRequest(input, v42)).toEqual({
            trackedEntityId: 'TrackedEnt1',
            programId: 'Program0001',
            page: 2,
            pageSize: 10,
            attributeId: 'Attribute01',
            order: { column: 'username', direction: 'asc' },
        })
    })

    it('drops the filter and username / attribute order on 2.41', () => {
        expect(resolveChangelogRequest(input, v41)).toMatchObject({
            attributeId: null,
            order: null,
        })
        expect(
            resolveChangelogRequest(
                {
                    ...input,
                    order: { column: 'attribute', direction: 'desc' },
                },
                v41
            ).order
        ).toBeNull()
    })

    it('keeps the createdAt order on 2.41', () => {
        expect(
            resolveChangelogRequest(
                {
                    ...input,
                    order: { column: 'createdAt', direction: 'asc' },
                },
                v41
            ).order
        ).toEqual({ column: 'createdAt', direction: 'asc' })
    })

    it('normalises a missing program and out-of-range paging', () => {
        expect(
            resolveChangelogRequest(
                { trackedEntityId: 'TrackedEnt1', page: 0, pageSize: 0 },
                v42
            )
        ).toEqual({
            trackedEntityId: 'TrackedEnt1',
            programId: null,
            page: 1,
            pageSize: 1,
            attributeId: null,
            order: null,
        })
    })
})

describe('changelogQueryParameters', () => {
    it('serialises the filter and order as DHIS2 expects', () => {
        expect(
            changelogQueryParameters({
                trackedEntityId: 'TrackedEnt1',
                programId: 'Program0001',
                page: 3,
                pageSize: 10,
                attributeId: 'Attribute01',
                order: { column: 'attribute', direction: 'desc' },
            })
        ).toEqual({
            page: 3,
            pageSize: 10,
            program: 'Program0001',
            filter: 'attribute:eq:Attribute01',
            order: 'attribute:desc',
        })
    })

    it('leaves unset parameters undefined so app-runtime drops them', () => {
        expect(
            changelogQueryParameters({
                trackedEntityId: 'TrackedEnt1',
                programId: null,
                page: 1,
                pageSize: 10,
                attributeId: null,
                order: null,
            })
        ).toEqual({
            page: 1,
            pageSize: 10,
            program: undefined,
            filter: undefined,
            order: undefined,
        })
    })
})

describe('fetchTrackedEntityChangelog', () => {
    const request = resolveChangelogRequest(
        { trackedEntityId: 'TrackedEnt1', page: 1, pageSize: 10 },
        v42
    )

    it('requests the changeLogs resource and parses the page', async () => {
        const { engine, requests } = fakeEngine({
            pager: {
                page: 1,
                pageSize: 10,
                nextPage:
                    'http://dhis2/api/tracker/trackedEntities/TrackedEnt1/changeLogs?page=2',
            },
            changeLogs: [
                {
                    createdBy: {
                        uid: 'User0000001',
                        username: 'admin',
                        firstName: 'John',
                        surname: 'Traore',
                    },
                    createdAt: '2026-10-23T15:52:02.386',
                    type: 'UPDATE',
                    change: {
                        attributeValue: {
                            attribute: 'Attribute01',
                            previousValue: 'Ada',
                            currentValue: 'Grace',
                        },
                    },
                },
            ],
        })

        const response = await fetchTrackedEntityChangelog(
            createProfileWidgetClient(engine),
            request
        )

        expect(requests).toEqual([
            {
                resource: 'tracker/trackedEntities/TrackedEnt1/changeLogs',
                params: {
                    page: 1,
                    pageSize: 10,
                    program: undefined,
                    filter: undefined,
                    order: undefined,
                },
            },
        ])
        expect(response.changeLogs).toHaveLength(1)
        expect(response.pager?.nextPage).toContain('page=2')
    })

    it('rejects a response that fails boundary validation', async () => {
        const { engine } = fakeEngine({ changeLogs: [{ type: 'MOVE' }] })

        await expect(
            fetchTrackedEntityChangelog(
                createProfileWidgetClient(engine),
                request
            )
        ).rejects.toBeInstanceOf(ZodError)
    })
})
