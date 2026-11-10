import { describe, expect, test } from 'vitest'
import immunisation from './__tests__/fixtures/immunisation-program.json'
import rmnch from './__tests__/fixtures/rmnch-register-program.json'
import { compileLayout } from './compileLayout'
import type { LayoutNode, RegisterLayout } from './layout'
import { registerMetadataOf, registerProgramSchema } from './metadata'

const RMNCH = registerMetadataOf(registerProgramSchema.parse(rmnch))
const IMMUNISATION = registerMetadataOf(
    registerProgramSchema.parse(immunisation)
)

const FIRST_NAME = { attribute: 'w75KJ2mc4zz' }
const LAST_NAME = { attribute: 'zDhUuAYrxNC' }
const BIRTH_DATE = { attribute: 'gHGyrwKPzej' }
const ENROLLED = { enrollment: 'enrolledAt' } as const
const ANC = 'edqlbukwRfQ'

// What a new row needs, as the paper lists it first.
const PERSON: LayoutNode[] = [
    { field: FIRST_NAME },
    { field: LAST_NAME },
    { field: BIRTH_DATE },
    { field: ENROLLED },
]

const layoutOf = (columns: LayoutNode[]): RegisterLayout => ({ columns })

const errorsOf = (...args: Parameters<typeof compileLayout>) => {
    const result = compileLayout(...args)
    if (result.ok) {
        throw new Error('Expected the layout to be refused')
    }
    return result.errors
}

const compiledOf = (...args: Parameters<typeof compileLayout>) => {
    const result = compileLayout(...args)
    if (!result.ok) {
        throw new Error(result.errors.join('; '))
    }
    return result.compiled
}

describe('compileLayout', () => {
    test('an ANC cohort layout compiles to slotted columns and two heading rows', () => {
        const compiled = compiledOf(
            layoutOf([
                ...PERSON,
                {
                    group: 'Second antenatal care visit',
                    children: [1, 2, 3].map((occurrence) => ({
                        field: {
                            stage: ANC,
                            occurrence,
                            eventDate: true as const,
                        },
                        label: `Visit ${occurrence}`,
                    })),
                },
            ]),
            RMNCH
        )

        expect(compiled.columns.map((c) => c.id)).toEqual([
            'person:w75KJ2mc4zz',
            'person:zDhUuAYrxNC',
            'person:gHGyrwKPzej',
            'enrollment:enrolledAt',
            `${ANC}#1:occurredAt`,
            `${ANC}#2:occurredAt`,
            `${ANC}#3:occurredAt`,
        ])
        expect(compiled.columns[1]).toMatchObject({
            label: 'Last name',
            slot: 'person',
            fieldId: 'zDhUuAYrxNC',
            field: { valueType: 'TEXT' },
        })
        expect(compiled.columns[3]?.label).toBe('Date of first visit')
        expect(compiled.headerRows).toEqual([
            [
                {
                    id: 'person:w75KJ2mc4zz',
                    label: 'First name',
                    span: 1,
                    rowSpan: 2,
                },
                {
                    id: 'person:zDhUuAYrxNC',
                    label: 'Last name',
                    span: 1,
                    rowSpan: 2,
                },
                {
                    id: 'person:gHGyrwKPzej',
                    label: 'Birth date',
                    span: 1,
                    rowSpan: 2,
                },
                {
                    id: 'enrollment:enrolledAt',
                    label: 'Date of first visit',
                    span: 1,
                    rowSpan: 2,
                },
                {
                    id: 'group:4',
                    label: 'Second antenatal care visit',
                    span: 3,
                },
            ],
            [1, 2, 3].map((n) => ({
                id: `${ANC}#${n}:occurredAt`,
                label: `Visit ${n}`,
                span: 1,
            })),
        ])
        expect(compiled.slots.map((s) => s.name)).toEqual([
            'person',
            'enrollment',
            `${ANC}#1`,
            `${ANC}#2`,
            `${ANC}#3`,
        ])
        expect(compiled.slots[3]).toMatchObject({
            kind: 'occurrence',
            stageId: ANC,
            occurrence: 2,
            hasDateColumn: true,
            label: 'Second antenatal care visit 2',
            stageName: 'Second antenatal care visit',
        })
    })

    test('a where slot is named by its sorted values', () => {
        const compiled = compiledOf(
            layoutOf([
                { field: FIRST_NAME },
                { field: LAST_NAME },
                { field: BIRTH_DATE },
                { field: ENROLLED },
                {
                    field: {
                        stage: 'ImmVaccin01',
                        where: { ImmDose0001: '2', ImmVaccine1: 'DPT' },
                        eventDate: true,
                    },
                },
                {
                    field: {
                        stage: 'ImmVaccin01',
                        where: { ImmVaccine1: 'DPT', ImmDose0001: '2' },
                        dataElement: 'ImmDose0001',
                    },
                },
            ]),
            IMMUNISATION
        )

        const name = 'ImmVaccin01?ImmDose0001=2&ImmVaccine1=DPT'
        expect(compiled.slots.map((s) => s.name)).toEqual([
            'person',
            'enrollment',
            name,
        ])
        expect(compiled.slots[2]).toEqual({
            name,
            stageId: 'ImmVaccin01',
            kind: 'where',
            where: { ImmDose0001: '2', ImmVaccine1: 'DPT' },
            occurrence: undefined,
            hasDateColumn: true,
            label: 'Vaccination: DPT 2',
            stageName: 'Vaccination',
            valuesLabel: 'DPT 2',
        })
        expect(compiled.columns.map((c) => c.id).slice(4)).toEqual([
            `${name}:occurredAt`,
            `${name}:ImmDose0001`,
        ])
    })

    test('rowLabel defaults to the first two text attributes', () => {
        const compiled = compiledOf(
            layoutOf([
                { field: BIRTH_DATE },
                { field: FIRST_NAME },
                { field: { attribute: 'VqEFza8wbwA' } },
                { field: LAST_NAME },
                { field: ENROLLED },
            ]),
            RMNCH
        )

        expect(compiled.rowLabel).toEqual([
            { slot: 'person', fieldId: 'w75KJ2mc4zz' },
            { slot: 'person', fieldId: 'VqEFza8wbwA' },
        ])
    })

    test('a layout names its own rowLabel', () => {
        const compiled = compiledOf(
            {
                ...layoutOf([
                    ...PERSON,
                    { field: { stage: 'WZbXY0S00lP', eventDate: true } },
                ]),
                rowLabel: [LAST_NAME],
            },
            RMNCH
        )

        expect(compiled.rowLabel).toEqual([
            { slot: 'person', fieldId: 'zDhUuAYrxNC' },
        ])
        expect(compiled.columns[4]).toMatchObject({
            id: 'WZbXY0S00lP:occurredAt',
        })
        expect(compiled.slots[2]).toMatchObject({
            kind: 'single',
            hasDateColumn: true,
        })
    })

    test('a column the program does not have is refused by name', () => {
        expect(
            errorsOf(
                layoutOf([
                    ...PERSON,
                    { field: { attribute: 'nope' }, label: 'Village' },
                ]),
                RMNCH
            )
        ).toEqual(['Column "Village": the program has no field nope'])
    })

    test('an occurrence on a stage that is not repeatable is refused', () => {
        expect(
            errorsOf(
                layoutOf([
                    ...PERSON,
                    {
                        field: {
                            stage: 'PFDfvmGpsR3',
                            occurrence: 1,
                            eventDate: true,
                        },
                        label: 'Birth',
                    },
                ]),
                RMNCH
            )
        ).toEqual(['Column "Birth": Care at birth is not repeatable'])
    })

    test('a column of a repeatable stage that names no event is refused, naming the column', () => {
        expect(
            errorsOf(
                layoutOf([
                    ...PERSON,
                    { field: { stage: ANC, eventDate: true }, label: 'ANC' },
                ]),
                RMNCH
            )
        ).toEqual([
            'Column "ANC": Second antenatal care visit is repeatable, so the column needs an occurrence or a where',
        ])
    })

    test('a repeatable slot with data columns but no date column is refused', () => {
        expect(
            errorsOf(
                layoutOf([
                    ...PERSON,
                    {
                        field: {
                            stage: ANC,
                            occurrence: 2,
                            dataElement: 'ImmDose0001',
                        },
                    },
                ]),
                RMNCH
            )
        ).toEqual([
            'Column "ImmDose0001": the program has no field ImmDose0001',
        ])
        const [dataElement] = [
            ...(RMNCH.stages.get(ANC)?.dataElements.keys() ?? []),
        ]
        expect(
            errorsOf(
                layoutOf([
                    ...PERSON,
                    {
                        field: {
                            stage: ANC,
                            occurrence: 2,
                            dataElement: dataElement ?? '',
                        },
                    },
                ]),
                RMNCH
            )
        ).toEqual([
            'Second antenatal care visit 2 has data columns but no date column',
        ])
    })

    test('a stage that is not repeatable may leave out its date', () => {
        const [dataElement] = [
            ...(RMNCH.stages.get('PFDfvmGpsR3')?.dataElements.keys() ?? []),
        ]

        expect(
            compileLayout(
                layoutOf([
                    ...PERSON,
                    {
                        field: {
                            stage: 'PFDfvmGpsR3',
                            dataElement: dataElement ?? '',
                        },
                    },
                ]),
                RMNCH
            ).ok
        ).toBe(true)
    })

    test('a layout that leaves out what a new row needs is refused', () => {
        expect(
            errorsOf(
                layoutOf([
                    { field: FIRST_NAME },
                    { field: LAST_NAME },
                    { field: ENROLLED },
                ]),
                RMNCH
            )
        ).toEqual([
            'The layout leaves out Birth date, which a new row cannot be saved without',
        ])
        expect(errorsOf(layoutOf(PERSON.slice(0, 3)), RMNCH)).toEqual([
            'The layout leaves out Date of first visit, which a new row cannot be saved without',
        ])
    })

    test('a compulsory data element is required only where the stage checks on insert', () => {
        const stage = RMNCH.stages.get(ANC)
        if (stage === undefined) {
            throw new Error('The fixture has no ANC stage')
        }
        const strict = {
            ...RMNCH,
            stages: new Map(RMNCH.stages).set(ANC, {
                ...stage,
                validationStrategy: 'ON_UPDATE_AND_INSERT',
                dataElements: new Map([
                    [
                        'de1',
                        {
                            name: 'Hb',
                            field: { valueType: 'NUMBER' },
                            compulsory: true,
                        },
                    ],
                ]),
            }),
        }
        const columns: LayoutNode[] = [
            ...PERSON,
            { field: { stage: ANC, occurrence: 1, eventDate: true } },
        ]

        expect(errorsOf(layoutOf(columns), strict)).toEqual([
            'The layout leaves out Hb, which a new row cannot be saved without',
        ])
        expect(
            compileLayout(
                layoutOf([
                    ...columns,
                    {
                        field: {
                            stage: ANC,
                            occurrence: 1,
                            dataElement: 'de1',
                        },
                    },
                ]),
                strict
            ).ok
        ).toBe(true)
        expect(compileLayout(layoutOf(columns), RMNCH).ok).toBe(true)
    })

    test('the same field in one slot twice is refused by its column id', () => {
        const dated = { stage: ANC, occurrence: 1, eventDate: true as const }

        expect(
            errorsOf(
                layoutOf([
                    ...PERSON,
                    { field: FIRST_NAME, label: 'Given name' },
                ]),
                RMNCH
            )
        ).toEqual([
            'Column "Given name": person:w75KJ2mc4zz appears more than once',
        ])
        expect(
            errorsOf(
                layoutOf([
                    ...PERSON,
                    { field: dated },
                    { field: dated, label: 'Again' },
                ]),
                RMNCH
            )
        ).toEqual([
            `Column "Again": ${ANC}#1:occurredAt appears more than once`,
        ])
        const where = { stage: 'ImmVaccin01', eventDate: true as const }
        expect(
            errorsOf(
                layoutOf([
                    ...PERSON,
                    {
                        field: {
                            ...where,
                            where: { ImmDose0001: '2', ImmVaccine1: 'DPT' },
                        },
                    },
                    {
                        field: {
                            ...where,
                            where: { ImmVaccine1: 'DPT', ImmDose0001: '2' },
                        },
                    },
                ]),
                IMMUNISATION
            )
        ).toEqual([
            'Column "Event date": ImmVaccin01?ImmDose0001=2&ImmVaccine1=DPT:occurredAt appears more than once',
        ])
    })

    test('a compulsory data element a where slot holds is not demanded as a column', () => {
        const stage = IMMUNISATION.stages.get('ImmVaccin01')
        if (stage === undefined) {
            throw new Error('The fixture has no vaccination stage')
        }
        const strict = {
            ...IMMUNISATION,
            stages: new Map(IMMUNISATION.stages).set('ImmVaccin01', {
                ...stage,
                validationStrategy: 'ON_UPDATE_AND_INSERT',
                dataElements: new Map(
                    [...stage.dataElements].map(([id, element]) => [
                        id,
                        { ...element, compulsory: true },
                    ])
                ),
            }),
        }
        const slot = {
            stage: 'ImmVaccin01',
            where: { ImmVaccine1: 'DPT' },
        }
        const layout = (extra: LayoutNode[]) =>
            layoutOf([
                ...PERSON,
                { field: { ...slot, eventDate: true } },
                ...extra,
            ])

        expect(errorsOf(layout([]), strict)).toEqual([
            'The layout leaves out Dose, which a new row cannot be saved without',
        ])
        expect(
            compileLayout(
                layout([{ field: { ...slot, dataElement: 'ImmDose0001' } }]),
                strict
            ).ok
        ).toBe(true)
    })

    test('a where code that is not an option is a layout error', () => {
        const slot = { stage: 'ImmVaccin01', where: { ImmVaccine1: 'bcg' } }
        expect(
            errorsOf(
                layoutOf([...PERSON, { field: { ...slot, eventDate: true } }]),
                IMMUNISATION
            )
        ).toEqual(['bcg is not an option of Vaccine'])
    })

    test('a bad where code is said once however many columns the slot has', () => {
        const slot = { stage: 'ImmVaccin01', where: { ImmVaccine1: 'bcg' } }
        expect(
            errorsOf(
                layoutOf([
                    ...PERSON,
                    { field: { ...slot, eventDate: true } },
                    { field: { ...slot, dataElement: 'ImmDose0001' } },
                ]),
                IMMUNISATION
            )
        ).toEqual(['bcg is not an option of Vaccine'])
    })

    test('a rowLabel field with no column is refused and registers no slot', () => {
        const stage = RMNCH.stages.get(ANC)
        const [compulsory] = [...(stage?.dataElements.keys() ?? [])]
        if (stage === undefined || compulsory === undefined) {
            throw new Error('The fixture has no ANC stage')
        }
        // A stage that checks on insert would demand its compulsory element if the row label's slot counted.
        const strict = {
            ...RMNCH,
            stages: new Map(RMNCH.stages).set(ANC, {
                ...stage,
                validationStrategy: 'ON_UPDATE_AND_INSERT',
                dataElements: new Map([
                    [
                        compulsory,
                        {
                            name: 'Hb',
                            field: { valueType: 'NUMBER' },
                            compulsory: true,
                        },
                    ],
                ]),
            }),
        }
        const rowLabel = [
            { stage: ANC, occurrence: 1, dataElement: compulsory },
        ]

        expect(errorsOf({ ...layoutOf(PERSON), rowLabel }, strict)).toEqual([
            'The row label uses Hb, which the layout has no column for',
        ])
        expect(
            errorsOf(
                { ...layoutOf(PERSON), rowLabel: [{ attribute: 'nope' }] },
                RMNCH
            )
        ).toEqual(['Column "nope": the program has no field nope'])
    })
})
