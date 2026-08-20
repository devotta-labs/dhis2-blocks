import { resolveWorkingListCapabilities } from '../api/capabilities'
import { WorkingListBoundaryError, type WorkingListClient } from '../api/client'
import type {
    FieldCatalog,
    WorkingListConfiguration,
    WorkingListField,
} from '../domain/model'
import { fetchWorkingListPage } from './fetchers'

const integerAttribute: WorkingListField = {
    id: 'Attribute01',
    displayName: 'Count',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'INTEGER_POSITIVE',
    filterable: true,
}

const ownerField: WorkingListField = {
    id: 'programOwnerId',
    displayName: 'Owner',
    source: 'system',
    scope: 'trackedEntity',
    valueType: 'ORGANISATION_UNIT',
    filterable: false,
}

const fields: FieldCatalog = new Map([
    [integerAttribute.id, integerAttribute],
    [ownerField.id, ownerField],
])

const configuration: WorkingListConfiguration = {
    mode: 'trackedEntity',
    programId: 'Program0001',
    columns: [integerAttribute.id],
    sort: { fieldId: 'createdAt', direction: 'desc' },
    filters: [],
}

const pageInput = (client: WorkingListClient) => ({
    client,
    context: { programId: 'Program0001', orgUnitId: 'OrgUnit0001' },
    configuration,
    pagination: { page: 3, pageSize: 15 },
    capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
    fields,
})

const clientReturning = (response: unknown) =>
    ({
        query: jest.fn().mockResolvedValue(response),
        mutate: jest.fn(),
    }) as unknown as WorkingListClient

describe('working-list page fetching with lenient data values', () => {
    let warn: jest.SpyInstance

    beforeEach(() => {
        warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    })

    afterEach(() => {
        warn.mockRestore()
    })

    it('returns rows with invalid cells and warns once per page', async () => {
        const page = await fetchWorkingListPage(
            pageInput(
                clientReturning({
                    trackedEntities: [
                        {
                            trackedEntity: 'EntityAaaa1',
                            attributes: [
                                {
                                    attribute: integerAttribute.id,
                                    value: '-4',
                                },
                            ],
                            programOwners: [
                                {
                                    orgUnit: 'OrgUnit0001',
                                    program: 'Program0001',
                                },
                            ],
                        },
                        {
                            trackedEntity: 'EntityBbbb1',
                            attributes: [
                                {
                                    attribute: integerAttribute.id,
                                    value: '7',
                                },
                            ],
                            programOwners: [
                                {
                                    orgUnit: 'OrgUnit0001',
                                    program: 'Program0001',
                                },
                            ],
                        },
                    ],
                })
            )
        )

        if (page.mode !== 'trackedEntity') {
            throw new Error('unexpected mode')
        }
        expect(page.records).toHaveLength(2)
        const [first, second] = page.records
        expect(first.values[integerAttribute.id]).toEqual({
            valid: false,
            raw: '-4',
            message: 'INTEGER_POSITIVE requires a value greater than zero',
        })
        expect(second.values[integerAttribute.id]).toEqual({
            valid: true,
            value: 7,
        })
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn).toHaveBeenCalledWith(
            '[working-list] 1 invalid data value(s) on page 3',
            [
                {
                    row: 'EntityAaaa1',
                    field: integerAttribute.id,
                    message:
                        'INTEGER_POSITIVE requires a value greater than zero',
                    raw: '-4',
                },
            ]
        )
    })

    it('stays silent when every data value is valid', async () => {
        await fetchWorkingListPage(
            pageInput(
                clientReturning({
                    trackedEntities: [
                        {
                            trackedEntity: 'EntityAaaa1',
                            attributes: [
                                { attribute: integerAttribute.id, value: '7' },
                            ],
                            programOwners: [
                                {
                                    orgUnit: 'OrgUnit0001',
                                    program: 'Program0001',
                                },
                            ],
                        },
                    ],
                })
            )
        )
        expect(warn).not.toHaveBeenCalled()
    })

    it('keeps system columns fail-fast at the response boundary', async () => {
        await expect(
            fetchWorkingListPage(
                pageInput(
                    clientReturning({
                        trackedEntities: [
                            {
                                trackedEntity: 'EntityAaaa1',
                                attributes: [],
                                programOwners: [
                                    {
                                        orgUnit: 'not a uid',
                                        program: 'Program0001',
                                    },
                                ],
                            },
                        ],
                    })
                )
            )
        ).rejects.toThrow(WorkingListBoundaryError)
    })
})
