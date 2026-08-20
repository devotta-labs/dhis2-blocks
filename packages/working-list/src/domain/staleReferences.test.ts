import type {
    FieldCatalog,
    WorkingListConfiguration,
    WorkingListField,
} from './model'
import { WorkingListConfigurationSchema } from './schemas'
import {
    repairConfigurationReferences,
    validateConfigurationReferences,
} from './staleReferences'

const attribute: WorkingListField = {
    id: 'Attribute01',
    displayName: 'Name',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'TEXT',
    filterable: true,
}

const createdAt: WorkingListField = {
    id: 'createdAt',
    displayName: 'Created',
    source: 'system',
    scope: 'trackedEntity',
    valueType: 'DATETIME',
    filterable: false,
}

const stageField: WorkingListField = {
    id: 'DataElement1',
    displayName: 'Result',
    source: 'eventDataElement',
    scope: 'event',
    valueType: 'TEXT',
    filterable: true,
    programStageIds: ['ProgramStg1'],
}

const fields: FieldCatalog = new Map(
    [attribute, createdAt, stageField].map((field) => [field.id, field])
)

const metadata = {
    expectedProgramId: 'Program0001',
    fields,
    readableProgramStageIds: new Set(['ProgramStg1', 'OtherStage1']),
}

describe('stale working-list references', () => {
    it('detects cross-stage data elements in filters, columns, and sort', () => {
        const configuration: WorkingListConfiguration = {
            mode: 'event',
            programId: 'Program0001',
            programStageId: 'OtherStage1',
            filters: [
                {
                    field: stageField,
                    operator: 'like',
                    value: { kind: 'text', value: 'x' },
                },
            ],
            columns: [stageField.id],
            sort: { fieldId: stageField.id, direction: 'asc' },
        }

        expect(
            validateConfigurationReferences(configuration, metadata)
        ).toEqual({
            compatible: false,
            issues: expect.arrayContaining([
                expect.objectContaining({
                    kind: 'programStageFieldMismatch',
                    path: 'filters.0.field',
                }),
                expect.objectContaining({
                    kind: 'programStageFieldMismatch',
                    path: 'columns.0',
                }),
                expect.objectContaining({
                    kind: 'programStageFieldMismatch',
                    path: 'sort.fieldId',
                }),
            ]),
        })
    })

    it('applies only explicit repairs and revalidates the result', () => {
        const configuration: WorkingListConfiguration = {
            mode: 'trackedEntity',
            programId: 'Program0001',
            filters: [
                {
                    field: { ...attribute, id: 'MissingFld1' },
                    operator: 'like',
                    value: { kind: 'text', value: 'x' },
                },
            ],
            columns: [attribute.id],
            sort: { fieldId: 'MissingSort1', direction: 'asc' },
        }
        const validation = validateConfigurationReferences(
            configuration,
            metadata
        )
        if (!('issues' in validation)) {
            throw new Error('Expected stale references')
        }

        expect(
            repairConfigurationReferences({
                configuration,
                issues: validation.issues,
                decisions: [
                    { path: 'filters.0.field', action: 'remove' },
                    {
                        path: 'sort.fieldId',
                        action: 'replaceSort',
                        sort: { fieldId: 'createdAt', direction: 'desc' },
                    },
                ],
                metadata,
            })
        ).toEqual({
            status: 'repaired',
            configuration: {
                ...configuration,
                filters: [],
                sort: { fieldId: 'createdAt', direction: 'desc' },
            },
        })
    })

    it('keeps program and stage mismatches blocking', () => {
        const configuration: WorkingListConfiguration = {
            mode: 'event',
            programId: 'WrongPrg001',
            programStageId: 'MissingStg1',
            filters: [],
            columns: [attribute.id],
            sort: { fieldId: 'createdAt', direction: 'desc' },
        }
        const validation = validateConfigurationReferences(
            configuration,
            metadata
        )
        if (!('issues' in validation)) {
            throw new Error('Expected stale references')
        }

        expect(
            repairConfigurationReferences({
                configuration,
                issues: validation.issues,
                decisions: [],
                metadata,
            })
        ).toMatchObject({
            status: 'blocked',
            issues: expect.arrayContaining([
                expect.objectContaining({ kind: 'programMismatch' }),
                expect.objectContaining({ kind: 'missingProgramStage' }),
            ]),
        })
    })

    it('rejects zero-column configurations at the domain boundary', () => {
        expect(() =>
            WorkingListConfigurationSchema.parse({
                mode: 'trackedEntity',
                programId: 'Program0001',
                filters: [],
                columns: [],
                sort: { fieldId: 'createdAt', direction: 'desc' },
            })
        ).toThrow()
    })
})
