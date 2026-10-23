import {
    createProfileWidgetClient,
    type DataEngineLike,
    type DataEngineValue,
    type ProfileWidgetQueryRequest,
} from '../../api/client'
import type { ProfileValueType } from '../../types'
import type { FormattableValue } from './contracts'
import {
    collectLookupIds,
    fetchFileResourceNames,
    fetchOrganisationUnits,
    ORGANISATION_UNIT_BATCH_SIZE,
} from './lookups'

const value = (
    valueType: ProfileValueType,
    rawValue: string | null,
    extra: Partial<FormattableValue> = {}
): FormattableValue => ({ valueType, rawValue, label: 'Field', ...extra })

/** A fake engine that answers each request through `respond`. */
const createFakeEngine = (
    respond: (request: ProfileWidgetQueryRequest) => DataEngineValue
) => {
    const requests: ProfileWidgetQueryRequest[] = []
    const engine: DataEngineLike = {
        query: async (query) => {
            const entries = Object.entries(query).map(([key, request]) => {
                requests.push(request)
                return [key, respond(request)] as const
            })
            return Object.fromEntries(entries)
        },
        mutate: async () => {
            throw new Error('not used')
        },
    }
    return { client: createProfileWidgetClient(engine), requests }
}

describe('collectLookupIds', () => {
    it('collects sorted, unique file-resource and org-unit ids', () => {
        expect(
            collectLookupIds([
                value('FILE_RESOURCE', 'FileB'),
                value('FILE_RESOURCE', 'FileA'),
                value('FILE_RESOURCE', 'FileA'),
                value('IMAGE', 'ImageA'),
                value('ORGANISATION_UNIT', 'OrgUnitB'),
                value('ORGANISATION_UNIT', 'OrgUnitA'),
                value('ORGANISATION_UNIT', null),
                value('ORGANISATION_UNIT', ''),
                value('TEXT', 'FileC'),
            ])
        ).toEqual({
            fileResourceIds: ['FileA', 'FileB'],
            organisationUnitIds: ['OrgUnitA', 'OrgUnitB'],
        })
    })

    it('skips values whose option name wins', () => {
        expect(
            collectLookupIds([
                value('ORGANISATION_UNIT', 'OrgUnitA', {
                    options: [{ code: 'OrgUnitA', displayName: 'A' }],
                }),
            ])
        ).toEqual({ fileResourceIds: [], organisationUnitIds: [] })
    })
})

describe('fetchFileResourceNames', () => {
    it('requests each file resource and maps id to name', async () => {
        const { client, requests } = createFakeEngine((request) => ({
            id: request.id,
            displayName: `${request.id}.pdf`,
        }))

        const names = await fetchFileResourceNames(client, ['B', 'A', 'B'])

        expect([...names]).toEqual([
            ['A', 'A.pdf'],
            ['B', 'B.pdf'],
        ])
        expect(requests).toEqual([
            {
                resource: 'fileResources',
                id: 'A',
                params: { fields: 'id,displayName' },
            },
            {
                resource: 'fileResources',
                id: 'B',
                params: { fields: 'id,displayName' },
            },
        ])
    })

    it('leaves out a file resource that cannot be loaded', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { client } = createFakeEngine((request) => {
            if (request.id === 'Missing') {
                throw Object.assign(new Error('Not found'), {
                    details: { httpStatusCode: 404 },
                })
            }
            return { id: request.id, displayName: 'found.png' }
        })

        const names = await fetchFileResourceNames(client, ['Found', 'Missing'])

        expect([...names]).toEqual([['Found', 'found.png']])
        expect(warn).toHaveBeenCalledOnce()
        warn.mockRestore()
    })

    it('leaves out a file resource the user may not read', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { client } = createFakeEngine((request) => {
            if (request.id === 'Hidden') {
                throw Object.assign(new Error('Forbidden'), {
                    details: { httpStatusCode: 403 },
                })
            }
            return { id: request.id, displayName: 'found.png' }
        })

        const names = await fetchFileResourceNames(client, ['Found', 'Hidden'])

        expect([...names]).toEqual([['Found', 'found.png']])
        warn.mockRestore()
    })

    it('rejects on a server error, so the query can retry and report it', async () => {
        const { client } = createFakeEngine(() => {
            throw Object.assign(new Error('Server error'), {
                details: { httpStatusCode: 500 },
            })
        })

        await expect(fetchFileResourceNames(client, ['A'])).rejects.toThrow(
            'Server error'
        )
    })

    it('rejects on a network failure with no status', async () => {
        const { client } = createFakeEngine(() => {
            throw new Error('Network down')
        })

        await expect(fetchFileResourceNames(client, ['A'])).rejects.toThrow(
            'Network down'
        )
    })

    it('rejects when the response fails boundary validation', async () => {
        const { client } = createFakeEngine(() => ({ id: 'A' }))

        await expect(fetchFileResourceNames(client, ['A'])).rejects.toThrow()
    })
})

describe('fetchOrganisationUnits', () => {
    it('batches ids and keeps ancestor names root first', async () => {
        const ids = Array.from(
            { length: ORGANISATION_UNIT_BATCH_SIZE + 3 },
            (_, index) => `OrgUnit${index.toString().padStart(4, '0')}`
        )
        const { client, requests } = createFakeEngine((request) => {
            const filter = String(request.params?.filter)
            const batch = filter.slice('id:in:['.length, -1).split(',')
            return {
                organisationUnits: batch.map((id) => ({
                    id,
                    displayName: `Name ${id}`,
                    ancestors: [
                        { displayName: 'Sierra Leone' },
                        { displayName: 'Bo' },
                    ],
                })),
            }
        })

        const organisationUnits = await fetchOrganisationUnits(client, [
            ...ids,
            ids[0],
        ])

        expect(requests).toHaveLength(2)
        expect(requests[0]).toEqual({
            resource: 'organisationUnits',
            params: {
                fields: 'id,displayName,ancestors[displayName]',
                filter: `id:in:[${ids.slice(0, ORGANISATION_UNIT_BATCH_SIZE).join(',')}]`,
                paging: false,
            },
        })
        expect(organisationUnits.size).toBe(ids.length)
        expect(organisationUnits.get(ids[0])).toEqual({
            name: `Name ${ids[0]}`,
            path: ['Sierra Leone', 'Bo'],
        })
    })

    it('rejects when a batch fails, so the query can report it', async () => {
        const { client } = createFakeEngine(() => {
            throw Object.assign(new Error('Server error'), {
                details: { httpStatusCode: 500 },
            })
        })

        await expect(
            fetchOrganisationUnits(client, ['OrgUnitA'])
        ).rejects.toThrow('Server error')
    })
})
