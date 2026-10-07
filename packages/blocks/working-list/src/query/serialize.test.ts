import { resolveWorkingListCapabilities } from '../api/capabilities'
import type {
    FieldCatalog,
    WorkingListConfiguration,
    WorkingListField,
} from '../domain/model'
import { WorkingListContextSchema } from '../domain/schemas'
import {
    getSystemFilterDefinition,
    systemColumnFields,
} from '../registry/systemFilters'
import { createWorkingListValueTransformers } from '../registry/transformers'
import { planTrackedEntityJoin, serializeWorkingListRequest } from './serialize'

const attribute: WorkingListField = {
    id: 'Attribute01',
    displayName: 'Name',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'TEXT',
    filterable: true,
}

const dataElement: WorkingListField = {
    id: 'DataElement1',
    displayName: 'Result',
    source: 'eventDataElement',
    scope: 'event',
    valueType: 'INTEGER',
    filterable: true,
    programStageIds: ['ProgramStg1'],
}

const systemField = (id: string) => {
    const definition = getSystemFilterDefinition(id)

    if (!definition) {
        throw new Error(`Missing test system field ${id}`)
    }

    return definition.field
}

const fields: FieldCatalog = new Map([
    ...systemColumnFields.map((field) => [field.id, field] as const),
    [attribute.id, attribute],
    [dataElement.id, dataElement],
    ['enrollmentStatus', systemField('enrollmentStatus')],
    ['eventStatus', systemField('eventStatus')],
])

const trackedEntityConfiguration: WorkingListConfiguration = {
    mode: 'trackedEntity',
    programId: 'Program0001',
    columns: [attribute.id],
    sort: { fieldId: 'createdAt', direction: 'desc' },
    filters: [
        {
            field: attribute,
            operator: 'like',
            value: { kind: 'text', value: 'Test' },
        },
        {
            field: systemField('enrollmentStatus'),
            operator: 'in',
            value: { kind: 'options', values: ['ACTIVE'] },
        },
    ],
}

describe('Tracker working-list request serialization', () => {
    it('uses v41 TE parameters, SELECTED org units, paging and one order', () => {
        const request = serializeWorkingListRequest({
            context: {
                programId: 'Program0001',
                orgUnitId: 'OrgUnit0001',
            },
            configuration: trackedEntityConfiguration,
            pagination: { page: 2, pageSize: 25 },
            capabilities: resolveWorkingListCapabilities({ apiVersion: 41 }),
            fields,
        })

        expect(request).toMatchObject({
            resource: 'tracker/trackedEntities',
            params: {
                program: 'Program0001',
                orgUnits: 'OrgUnit0001',
                orgUnitMode: 'SELECTED',
                page: 2,
                pageSize: 25,
                order: 'createdAt:desc',
                programStatus: 'ACTIVE',
                filter: ['Attribute01:like:Test'],
            },
        })
        expect(request.params).not.toHaveProperty('enrollmentStatus')
    })

    it('rejects a context without a selected organisation unit', () => {
        expect(() =>
            WorkingListContextSchema.parse({ programId: 'Program0001' })
        ).toThrow()
    })

    it('routes TE attributes to filterAttributes and DEs to filter for events', () => {
        const request = serializeWorkingListRequest({
            context: {
                programId: 'Program0001',
                orgUnitId: 'OrgUnit0001',
            },
            configuration: {
                mode: 'event',
                programId: 'Program0001',
                programStageId: 'ProgramStg1',
                columns: [dataElement.id],
                sort: { fieldId: dataElement.id, direction: 'asc' },
                filters: [
                    {
                        field: attribute,
                        operator: 'startsWith',
                        value: { kind: 'text', value: 'A' },
                    },
                    {
                        field: dataElement,
                        operator: 'range',
                        value: { kind: 'numberRange', min: 2, max: 5 },
                    },
                    {
                        field: systemField('eventStatus'),
                        operator: 'in',
                        value: { kind: 'options', values: ['SCHEDULE'] },
                    },
                ],
            },
            pagination: { page: 1, pageSize: 15 },
            capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
            fields,
            today: '2026-08-18',
        })

        expect(request).toMatchObject({
            resource: 'tracker/events',
            params: {
                orgUnit: 'OrgUnit0001',
                orgUnitMode: 'SELECTED',
                programStage: 'ProgramStg1',
                order: 'DataElement1:asc',
                filterAttributes: ['Attribute01:sw:A'],
                filter: ['DataElement1:ge:2:le:5'],
                status: 'SCHEDULE',
                scheduledAfter: '2026-08-18',
            },
        })
    })

    it('defaults scheduled events from the DHIS2 server time zone at midnight', () => {
        vi.useFakeTimers().setSystemTime(new Date('2026-08-18T10:30:00.000Z'))

        try {
            const transformers = createWorkingListValueTransformers({
                systemInfo: {
                    calendar: 'gregorian',
                    dateFormat: 'YYYY-MM-DD',
                    serverTimeZoneId: 'Pacific/Kiritimati',
                },
            })

            const request = serializeWorkingListRequest({
                context: {
                    programId: 'Program0001',
                    orgUnitId: 'OrgUnit0001',
                },
                configuration: {
                    mode: 'event',
                    programId: 'Program0001',
                    programStageId: 'ProgramStg1',
                    columns: [attribute.id],
                    sort: { fieldId: 'createdAt', direction: 'desc' },
                    filters: [
                        {
                            field: systemField('eventStatus'),
                            operator: 'in',
                            value: {
                                kind: 'options',
                                values: ['SCHEDULE'],
                            },
                        },
                    ],
                },
                pagination: { page: 1, pageSize: 15 },
                capabilities: resolveWorkingListCapabilities({
                    apiVersion: 43,
                }),
                fields,
                serializationContext: transformers.serializationContext,
            })

            // UTC is still August 18, while the configured server is UTC+14.
            expect(request.params?.scheduledAfter).toBe('2026-08-19')
        } finally {
            vi.useRealTimers()
        }
    })

    it('rejects scheduled-event defaults without server date context', () => {
        expect(() =>
            serializeWorkingListRequest({
                context: {
                    programId: 'Program0001',
                    orgUnitId: 'OrgUnit0001',
                },
                configuration: {
                    mode: 'event',
                    programId: 'Program0001',
                    programStageId: 'ProgramStg1',
                    columns: [attribute.id],
                    sort: { fieldId: 'createdAt', direction: 'desc' },
                    filters: [
                        {
                            field: systemField('eventStatus'),
                            operator: 'in',
                            value: {
                                kind: 'options',
                                values: ['SCHEDULE'],
                            },
                        },
                    ],
                },
                pagination: { page: 1, pageSize: 15 },
                capabilities: resolveWorkingListCapabilities({
                    apiVersion: 43,
                }),
                fields,
            })
        ).toThrow('server time zone')
    })

    it('rejects a data-element filter from another stage', () => {
        expect(() =>
            serializeWorkingListRequest({
                context: {
                    programId: 'Program0001',
                    orgUnitId: 'OrgUnit0001',
                },
                configuration: {
                    mode: 'event',
                    programId: 'Program0001',
                    programStageId: 'OtherStage1',
                    columns: [attribute.id],
                    sort: { fieldId: 'createdAt', direction: 'desc' },
                    filters: [
                        {
                            field: dataElement,
                            operator: 'range',
                            value: { kind: 'numberRange', min: 1 },
                        },
                    ],
                },
                pagination: { page: 1, pageSize: 15 },
                capabilities: resolveWorkingListCapabilities({
                    apiVersion: 43,
                }),
                fields,
            })
        ).toThrow('does not belong to stage')
    })

    it('deduplicates tracked entities into one batch join', () => {
        const plan = planTrackedEntityJoin({
            events: [
                {
                    event: 'Event000001',
                    status: 'ACTIVE',
                    program: 'Program0001',
                    orgUnit: 'OrgUnit0001',
                    trackedEntity: 'Entity00001',
                    dataValues: [],
                },
                {
                    event: 'Event000002',
                    status: 'COMPLETED',
                    program: 'Program0001',
                    orgUnit: 'OrgUnit0001',
                    trackedEntity: 'Entity00001',
                    dataValues: [],
                },
            ],
            programId: 'Program0001',
            pageSize: 15,
        })

        expect(plan?.trackedEntityIds).toEqual(['Entity00001'])
        expect(plan?.request.params).toMatchObject({
            trackedEntities: 'Entity00001',
            pageSize: 15,
            program: 'Program0001',
        })
    })
})
