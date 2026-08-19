import type { TrackedEntity, TrackerEvent } from '../api/schemas'
import type { FieldCatalog, WorkingListField } from '../domain/model'
import {
    normalizeEventValues,
    normalizeTrackedEntityValues,
} from './normalizeRows'

const integerField: WorkingListField = {
    id: 'IntegerFld1',
    displayName: 'Count',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'INTEGER_POSITIVE',
    filterable: true,
}

const multiField: WorkingListField = {
    id: 'MultiText01',
    displayName: 'Tags',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'MULTI_TEXT',
    filterable: true,
    options: [
        { code: 'A', displayName: 'Alpha' },
        { code: 'B', displayName: 'Beta' },
    ],
}

const requiredField: WorkingListField = {
    id: 'RequiredFd1',
    displayName: 'National ID',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'TEXT',
    filterable: true,
    required: true,
}

const ownerField: WorkingListField = {
    id: 'programOwnerId',
    displayName: 'Owner',
    source: 'system',
    scope: 'trackedEntity',
    valueType: 'ORGANISATION_UNIT',
    filterable: false,
}

const fields: FieldCatalog = new Map(
    [integerField, multiField, requiredField, ownerField].map((field) => [
        field.id,
        field,
    ])
)

const record = (attributes: TrackedEntity['attributes']): TrackedEntity => ({
    trackedEntity: 'Entity00001',
    attributes,
    programOwners: [{ orgUnit: 'OrgUnit0001', program: 'Program0001' }],
})

describe('metadata-aware row normalization', () => {
    it('parses every known value into its registry-owned type', () => {
        const normalized = normalizeTrackedEntityValues(
            record([
                { attribute: integerField.id, value: '4' },
                { attribute: multiField.id, value: 'A,B' },
                { attribute: requiredField.id, value: 'id-1' },
            ]),
            fields
        )
        expect(normalized.values[integerField.id]).toEqual({
            valid: true,
            value: 4,
        })
        expect(normalized.values[multiField.id]).toEqual({
            valid: true,
            value: 'A,B',
        })
        expect(normalized.values.programOwnerId).toEqual({
            valid: true,
            value: 'OrgUnit0001',
        })
        expect(normalized.issues).toEqual([])
    })

    it('collects malformed known values as invalid cells instead of throwing', () => {
        const normalized = normalizeTrackedEntityValues(
            record([
                { attribute: integerField.id, value: '-1' },
                { attribute: requiredField.id, value: 'id-1' },
            ]),
            fields
        )
        expect(normalized.values[integerField.id]).toEqual({
            valid: false,
            raw: '-1',
            message: 'INTEGER_POSITIVE requires a value greater than zero',
        })
        expect(normalized.issues).toEqual([
            {
                fieldId: integerField.id,
                fieldName: 'Count',
                message: 'INTEGER_POSITIVE requires a value greater than zero',
                raw: '-1',
            },
        ])
    })

    it('collects stale option codes as invalid cells', () => {
        const normalized = normalizeTrackedEntityValues(
            record([
                { attribute: multiField.id, value: 'A,MISSING' },
                { attribute: requiredField.id, value: 'id-1' },
            ]),
            fields
        )
        expect(normalized.values[multiField.id]).toEqual({
            valid: false,
            raw: 'A,MISSING',
            message: 'MISSING is not a known option',
        })
    })

    it('flags missing and empty required values, keeps optional gaps valid', () => {
        const missing = normalizeTrackedEntityValues(record([]), fields)
        expect(missing.values[requiredField.id]).toEqual({
            valid: false,
            raw: undefined,
            message: 'A required value is missing',
        })
        expect(missing.values[integerField.id]).toEqual({
            valid: true,
            value: undefined,
        })
        expect(missing.values[multiField.id]).toEqual({
            valid: true,
            value: undefined,
        })

        const empty = normalizeTrackedEntityValues(
            record([{ attribute: requiredField.id, value: '' }]),
            fields
        )
        expect(empty.values[requiredField.id]).toEqual({
            valid: false,
            raw: undefined,
            message: 'A required value is missing',
        })
    })

    it('localizes issue messages through the injected translator', () => {
        const normalized = normalizeTrackedEntityValues(
            record([{ attribute: integerField.id, value: 'abc' }]),
            fields,
            {
                translate: (message, values) =>
                    `#${message}|${JSON.stringify(values ?? null)}`,
            }
        )
        expect(normalized.values[integerField.id]).toMatchObject({
            valid: false,
            message:
                '#Expected a finite {{valueType}} value|{"valueType":"INTEGER_POSITIVE"}',
        })
    })

    it('tolerates additional unknown scalar response fields', () => {
        const normalized = normalizeTrackedEntityValues(
            record([
                { attribute: 'FutureFld01', value: 'future' },
                { attribute: requiredField.id, value: 'id-1' },
            ]),
            fields
        )
        expect(normalized.values.FutureFld01).toEqual({
            valid: true,
            value: 'future',
        })
        expect(normalized.issues).toEqual([])
    })

    it('keeps system columns fail-fast', () => {
        expect(() =>
            normalizeTrackedEntityValues(
                {
                    trackedEntity: 'Entity00001',
                    attributes: [],
                    programOwners: [
                        { orgUnit: 'not a uid', program: 'Program0001' },
                    ],
                },
                fields
            )
        ).toThrow('DHIS2 UID')
    })

    it('picks the program owner matching the requested program', () => {
        const normalized = normalizeTrackedEntityValues(
            {
                trackedEntity: 'Entity00001',
                attributes: [{ attribute: requiredField.id, value: 'id-1' }],
                programOwners: [
                    { orgUnit: 'OrgUnitAaa1', program: 'ProgramAaa1' },
                    { orgUnit: 'OrgUnitBbb1', program: 'ProgramBbb1' },
                ],
            },
            fields,
            { programId: 'ProgramBbb1' }
        )
        expect(normalized.values.programOwnerId).toEqual({
            valid: true,
            value: 'OrgUnitBbb1',
        })
    })
})

describe('metadata-aware event normalization', () => {
    const stageDataElement: WorkingListField = {
        id: 'DataElem001',
        displayName: 'Weight',
        source: 'eventDataElement',
        scope: 'event',
        valueType: 'NUMBER',
        filterable: true,
        programStageIds: ['StageAaaaa1'],
        requiredInStageIds: ['StageAaaaa1'],
    }
    const optionalDataElement: WorkingListField = {
        id: 'DataElem002',
        displayName: 'Notes',
        source: 'eventDataElement',
        scope: 'event',
        valueType: 'TEXT',
        filterable: true,
        programStageIds: ['StageAaaaa1'],
    }
    const eventFields: FieldCatalog = new Map(
        [stageDataElement, optionalDataElement].map((field) => [
            field.id,
            field,
        ])
    )
    const event = (dataValues: TrackerEvent['dataValues']): TrackerEvent => ({
        event: 'EventAaaaa1',
        program: 'Program0001',
        programStage: 'StageAaaaa1',
        orgUnit: 'OrgUnit0001',
        status: 'ACTIVE',
        dataValues,
    })

    it('collects invalid data values while keeping strict system columns', () => {
        const normalized = normalizeEventValues(
            event([{ dataElement: stageDataElement.id, value: 'oops' }]),
            eventFields
        )
        expect(normalized.values[stageDataElement.id]).toEqual({
            valid: false,
            raw: 'oops',
            message: 'Expected a finite NUMBER value',
        })
        expect(normalized.values.eventOrgUnit).toEqual({
            valid: true,
            value: 'OrgUnit0001',
        })
        expect(normalized.issues).toHaveLength(1)
    })

    it('flags compulsory stage data elements without a value', () => {
        const normalized = normalizeEventValues(event([]), eventFields)
        expect(normalized.values[stageDataElement.id]).toEqual({
            valid: false,
            raw: undefined,
            message: 'A required value is missing',
        })
        expect(normalized.values[optionalDataElement.id]).toEqual({
            valid: true,
            value: undefined,
        })
    })

    it('does not require the data element outside its compulsory stage', () => {
        const normalized = normalizeEventValues(
            {
                event: 'EventBbbbb1',
                program: 'Program0001',
                programStage: 'StageBbbbb1',
                orgUnit: 'OrgUnit0001',
                status: 'ACTIVE',
                dataValues: [],
            },
            eventFields
        )
        expect(normalized.values[stageDataElement.id]).toBeUndefined()
        expect(normalized.issues).toEqual([])
    })

    it('fails fast on a malformed event organisation unit', () => {
        const eventOrgUnitField: WorkingListField = {
            id: 'eventOrgUnit',
            displayName: 'Event organisation unit',
            source: 'system',
            scope: 'event',
            valueType: 'ORGANISATION_UNIT',
            filterable: false,
        }
        const strictFields: FieldCatalog = new Map([
            ...eventFields,
            [eventOrgUnitField.id, eventOrgUnitField],
        ])
        expect(() =>
            normalizeEventValues(
                {
                    event: 'EventAaaaa1',
                    program: 'Program0001',
                    programStage: 'StageAaaaa1',
                    orgUnit: 'not a uid',
                    status: 'ACTIVE',
                    dataValues: [],
                },
                strictFields
            )
        ).toThrow('DHIS2 UID')
    })
})
