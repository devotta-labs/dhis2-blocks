import type { DataElementMeta, StageMetadata } from '../api/schemas'
import {
    attribution,
    dataElement,
    emptyEffects,
    stageMetadata,
} from './__fixtures__/builders'
import {
    buildFormModel,
    type BuildFormModelInput,
    type FieldModel,
    type SectionModel,
} from './buildFormModel'

const baseInput = (
    metadata: StageMetadata,
    extra: Partial<BuildFormModelInput> = {}
): BuildFormModelInput => ({
    metadata,
    effective: {},
    stored: {},
    effects: emptyEffects(),
    optionGroupOptions: new Map(),
    fieldErrors: {},
    showAllErrors: false,
    isCompleting: false,
    ...extra,
})

const options = (...codes: string[]) =>
    codes.map((code) => ({ id: `id-${code}`, code, label: `Label ${code}` }))

const threeFields = () =>
    stageMetadata([dataElement('a'), dataElement('b'), dataElement('c')])

describe('buildFormModel', () => {
    it('builds a field model per data element, in section order', () => {
        const metadata = stageMetadata([
            dataElement('a', {
                description: 'Help',
                valueType: 'INTEGER',
                compulsory: true,
            }),
            dataElement('b'),
        ])
        const model = buildFormModel(
            undefined,
            baseInput(metadata, { effective: { a: '5' } })
        )
        expect(model.sections).toEqual([
            {
                id: '__default',
                name: 'Stage',
                hidden: false,
                fieldIds: ['a', 'b'],
                allFieldIds: ['a', 'b'],
            },
        ])
        expect(model.fields.get('a')).toMatchObject({
            id: 'a',
            label: 'Label a',
            description: 'Help',
            kind: 'number',
            inputMode: 'numeric',
            value: '5',
            disabled: false,
            required: true,
            unsupported: false,
            messages: { ruleErrors: [] },
        })
        expect(model.fields.get('b')?.value).toBeUndefined()
    })

    it('unchanged field keeps identity across builds', () => {
        const metadata = threeFields()
        const first = buildFormModel(
            undefined,
            baseInput(metadata, { effective: { a: '1', b: '2' } })
        )
        const second = buildFormModel(
            first,
            baseInput(metadata, { effective: { a: '1', b: 'changed' } })
        )
        expect(second.fields.get('b')).not.toBe(first.fields.get('b'))
        expect(second.fields.get('b')?.value).toBe('changed')
        expect(second.fields.get('a')).toBe(first.fields.get('a'))
        expect(second.fields.get('c')).toBe(first.fields.get('c'))
        expect(second.sections[0]).toBe(first.sections[0])
    })

    it('keeps the sections array when only a field value changed', () => {
        const metadata = threeFields()
        const first = buildFormModel(
            undefined,
            baseInput(metadata, { effective: { a: '1' } })
        )
        const second = buildFormModel(
            first,
            baseInput(metadata, { effective: { a: '2' } })
        )
        expect(second).not.toBe(first)
        expect(second.sections).toBe(first.sections)
    })

    it('returns the previous model when nothing changed', () => {
        const metadata = threeFields()
        const first = buildFormModel(undefined, baseInput(metadata))
        expect(buildFormModel(first, baseInput(metadata))).toBe(first)
    })

    it('keeps every field when metadata is refetched with identical content', () => {
        const build = (): StageMetadata =>
            stageMetadata([
                dataElement('a', { options: options('x', 'y') }),
                dataElement('b', { valueType: 'INTEGER' }),
            ])
        const first = buildFormModel(undefined, baseInput(build()))
        const second = buildFormModel(first, baseInput(build()))
        expect(second.fields.get('a')).toBe(first.fields.get('a'))
        expect(second.fields.get('b')).toBe(first.fields.get('b'))
        expect(second.sections[0]).toBe(first.sections[0])
        expect(second).toBe(first)
    })

    it('replaces a field when its metadata changes', () => {
        const first = buildFormModel(undefined, baseInput(threeFields()))
        const changed = stageMetadata([
            dataElement('a'),
            dataElement('b', { label: 'Renamed' }),
            dataElement('c'),
        ])
        const second = buildFormModel(first, baseInput(changed))
        const renamed: FieldModel | undefined = second.fields.get('b')
        expect(renamed?.label).toBe('Renamed')
        expect(second.fields.get('a')).toBe(first.fields.get('a'))
    })

    it('rule message change only replaces that field', () => {
        const metadata = threeFields()
        const withMessage = (text: string) => {
            const effects = emptyEffects()
            effects.messages.set('b', [
                { kind: 'warning', text, by: attribution() },
            ])
            return effects
        }
        const first = buildFormModel(
            undefined,
            baseInput(metadata, { effects: withMessage('Careful') })
        )
        // A fresh effects object with equal content keeps identity.
        const same = buildFormModel(
            first,
            baseInput(metadata, { effects: withMessage('Careful') })
        )
        expect(same.fields.get('b')).toBe(first.fields.get('b'))

        const second = buildFormModel(
            first,
            baseInput(metadata, { effects: withMessage('Very careful') })
        )
        expect(second.fields.get('b')?.messages.warning).toBe('Very careful')
        expect(second.fields.get('a')).toBe(first.fields.get('a'))
        expect(second.fields.get('c')).toBe(first.fields.get('c'))
    })

    it('splits rule messages by kind', () => {
        const by = attribution()
        const effects = emptyEffects()
        effects.messages.set('a', [
            { kind: 'error', text: 'E', by },
            { kind: 'warning', text: 'W', by },
            { kind: 'errorOnComplete', text: 'EOC', by },
            { kind: 'warningOnComplete', text: 'WOC', by },
        ])
        const field = buildFormModel(
            undefined,
            baseInput(threeFields(), { effects })
        ).fields.get('a')
        expect(field?.messages).toEqual({
            warning: 'W',
            errorOnComplete: 'EOC',
            warningOnComplete: 'WOC',
            ruleErrors: [{ kind: 'error', text: 'E', by }],
        })
    })

    it('carries the value error as the field error', () => {
        const field = buildFormModel(
            undefined,
            baseInput(threeFields(), {
                effective: { a: 'x' },
                fieldErrors: {
                    a: { code: 'integer', message: 'Enter a number' },
                },
            })
        ).fields.get('a')
        expect(field?.messages.error).toBe('Enter a number')
    })

    it('assigned field is disabled with assignedBy', () => {
        const by = attribution('calc')
        const effects = emptyEffects()
        effects.assignedValues.set('a', { value: '7', by })
        const model = buildFormModel(
            undefined,
            baseInput(threeFields(), { effects, effective: { a: '7' } })
        )
        expect(model.fields.get('a')).toMatchObject({
            disabled: true,
            assignedBy: by,
            value: '7',
        })
        expect(model.fields.get('b')?.disabled).toBe(false)
        expect(model.fields.get('b')?.assignedBy).toBeUndefined()
    })

    it('rule-mandatory field is required', () => {
        const effects = emptyEffects()
        effects.mandatoryFields.set('a', [attribution()])
        const model = buildFormModel(
            undefined,
            baseInput(threeFields(), { effects })
        )
        expect(model.fields.get('a')?.required).toBe(true)
        expect(model.fields.get('b')?.required).toBe(false)
    })

    it('flags a missing required value only once errors are shown', () => {
        const metadata = stageMetadata([dataElement('a', { compulsory: true })])
        const missing = (extra: Partial<BuildFormModelInput>) =>
            buildFormModel(undefined, baseInput(metadata, extra)).fields.get(
                'a'
            )?.requiredMissing
        expect(missing({})).toBe(false)
        expect(missing({ showAllErrors: true })).toBe(true)
        expect(missing({ isCompleting: true })).toBe(true)
        expect(missing({ showAllErrors: true, effective: { a: 'x' } })).toBe(
            false
        )
    })

    it('hidden field is flagged hidden, not listed, and has no messages', () => {
        const by = attribution()
        const effects = emptyEffects()
        effects.hiddenFields.set('b', [by])
        effects.messages.set('b', [{ kind: 'error', text: 'E', by }])
        const model = buildFormModel(
            undefined,
            baseInput(threeFields(), { effects })
        )
        expect(model.sections[0].fieldIds).toEqual(['a', 'c'])
        expect(model.fields.get('b')).toMatchObject({
            hidden: true,
            messages: { ruleErrors: [] },
        })
        expect(model.fields.get('a')?.hidden).toBe(false)
    })

    it('hidden section is hidden and lists no fields', () => {
        const metadata = stageMetadata(
            [dataElement('a'), dataElement('b'), dataElement('c')],
            {
                sections: [
                    { id: 's1', name: 'One', dataElementIds: ['a', 'b'] },
                    { id: 's2', name: 'Two', dataElementIds: ['c'] },
                ],
            }
        )
        const effects = emptyEffects()
        effects.hiddenSections.set('s1', [attribution()])
        const model = buildFormModel(
            undefined,
            baseInput(metadata, { effects })
        )
        const expected: SectionModel[] = [
            {
                id: 's1',
                name: 'One',
                hidden: true,
                fieldIds: [],
                allFieldIds: ['a', 'b'],
            },
            {
                id: 's2',
                name: 'Two',
                hidden: false,
                fieldIds: ['c'],
                allFieldIds: ['c'],
            },
        ]
        expect(model.sections).toEqual(expected)
        expect(model.fields.get('a')?.hidden).toBe(true)
        expect(model.fields.get('c')?.hidden).toBe(false)
    })

    it('a data element outside every section is not shown', () => {
        const metadata = stageMetadata([dataElement('a'), dataElement('b')], {
            sections: [{ id: 's1', name: 'One', dataElementIds: ['a'] }],
        })
        const model = buildFormModel(undefined, baseInput(metadata))
        expect(model.fields.get('b')?.hidden).toBe(true)
        expect(model.sections[0].fieldIds).toEqual(['a'])
    })

    describe('choices', () => {
        const choiceField = (
            extra: Partial<DataElementMeta> = {},
            input: Partial<BuildFormModelInput> = {}
        ) =>
            buildFormModel(
                undefined,
                baseInput(
                    stageMetadata([
                        dataElement('a', {
                            options: options('x', 'y', 'z'),
                            ...extra,
                        }),
                    ]),
                    input
                )
            ).fields.get('a')

        it('lists the option set as choices', () => {
            expect(choiceField()).toMatchObject({
                kind: 'choice',
                choices: [
                    { value: 'x', label: 'Label x' },
                    { value: 'y', label: 'Label y' },
                    { value: 'z', label: 'Label z' },
                ],
            })
        })

        it('has no choices for a field without an option set', () => {
            const field = buildFormModel(
                undefined,
                baseInput(threeFields())
            ).fields.get('a')
            expect(field?.choices).toBeUndefined()
        })

        it('hidden option is removed from choices', () => {
            const effects = emptyEffects()
            effects.hiddenOptions.set('a', new Set(['y']))
            expect(
                choiceField({}, { effects })?.choices?.map((c) => c.value)
            ).toEqual(['x', 'z'])
        })

        it('keeps the kind stable while options are hidden', () => {
            const effects = emptyEffects()
            effects.hiddenOptions.set('a', new Set(['x', 'y']))
            const field = choiceField(
                { options: options('1', '2', '3', '4', '5', '6') },
                {}
            )
            expect(field?.kind).toBe('select')
            const hiding = buildFormModel(
                undefined,
                baseInput(
                    stageMetadata([
                        dataElement('a', {
                            options: options('1', '2', '3', '4', '5', '6'),
                        }),
                    ]),
                    { effects }
                )
            ).fields.get('a')
            expect(hiding?.kind).toBe('select')
        })

        it('hidden option group removes the codes of the group', () => {
            const effects = emptyEffects()
            effects.optionGroups.set('a', {
                hidden: new Set(['g1']),
                shown: new Set(),
            })
            const field = choiceField(
                {},
                {
                    effects,
                    optionGroupOptions: new Map([['g1', new Set(['x', 'z'])]]),
                }
            )
            expect(field?.choices?.map((c) => c.value)).toEqual(['y'])
        })

        it('shown option groups restrict choices to the union of the groups', () => {
            const effects = emptyEffects()
            effects.optionGroups.set('a', {
                hidden: new Set(),
                shown: new Set(['g1', 'g2']),
            })
            const field = choiceField(
                {},
                {
                    effects,
                    optionGroupOptions: new Map([
                        ['g1', new Set(['x'])],
                        ['g2', new Set(['z'])],
                    ]),
                }
            )
            expect(field?.choices?.map((c) => c.value)).toEqual(['x', 'z'])
        })

        it('hidden wins over shown for the same option', () => {
            const effects = emptyEffects()
            effects.optionGroups.set('a', {
                hidden: new Set(['g2']),
                shown: new Set(['g1']),
            })
            const field = choiceField(
                {},
                {
                    effects,
                    optionGroupOptions: new Map([
                        ['g1', new Set(['x', 'y'])],
                        ['g2', new Set(['y'])],
                    ]),
                }
            )
            expect(field?.choices?.map((c) => c.value)).toEqual(['x'])
        })

        it('an option group missing from the map contributes no options', () => {
            const effects = emptyEffects()
            effects.optionGroups.set('a', {
                hidden: new Set(['unknown']),
                shown: new Set(),
            })
            expect(
                choiceField({}, { effects })?.choices?.map((c) => c.value)
            ).toEqual(['x', 'y', 'z'])
        })

        it('keeps a stored value that is not in the option set visible', () => {
            const field = choiceField({}, { effective: { a: 'retired' } })
            expect(field?.value).toBe('retired')
            expect(field?.choices).toEqual([
                { value: 'x', label: 'Label x' },
                { value: 'y', label: 'Label y' },
                { value: 'z', label: 'Label z' },
                { value: 'retired', label: 'retired' },
            ])
            expect(field?.messages.error).toBeUndefined()
        })

        it('keeps a selected value that a rule hid, with its own label', () => {
            const effects = emptyEffects()
            effects.hiddenOptions.set('a', new Set(['y']))
            const field = choiceField({}, { effects, effective: { a: 'y' } })
            expect(field?.choices?.map((c) => c.value)).toEqual(['x', 'z', 'y'])
            expect(field?.choices?.at(-1)).toEqual({
                value: 'y',
                label: 'Label y',
            })
        })

        it('keeps each unknown code of a multi-select value visible', () => {
            const field = choiceField(
                { valueType: 'MULTI_TEXT' },
                { effective: { a: 'x,gone' } }
            )
            expect(field?.kind).toBe('multiSelect')
            expect(field?.choices?.map((c) => c.value)).toEqual([
                'x',
                'y',
                'z',
                'gone',
            ])
        })

        it('an empty option set is unsupported and read-only', () => {
            const field = choiceField(
                { options: [] },
                { effective: { a: 'x' } }
            )
            expect(field).toMatchObject({
                kind: 'unsupported',
                unsupported: true,
                disabled: true,
                value: 'x',
            })
            expect(field?.choices).toBeUndefined()
            expect(field?.unsupportedReason).toBe('noOptions')
        })

        it('reads a radio render type as the radio layout', () => {
            const layout = (desktop?: string, mobile?: string) =>
                choiceField({
                    options: options('x', 'y'),
                    renderType: {
                        ...(desktop !== undefined && { desktop }),
                        ...(mobile !== undefined && { mobile }),
                    },
                })?.radioLayout
            expect(layout('VERTICAL_RADIOBUTTONS')).toBe('vertical')
            expect(layout('HORIZONTAL_RADIOBUTTONS')).toBe('horizontal')
            expect(layout(undefined, 'HORIZONTAL_RADIOBUTTONS')).toBe(
                'horizontal'
            )
            expect(layout('DROPDOWN')).toBeUndefined()
            expect(
                choiceField({ options: options('x', 'y') })?.radioLayout
            ).toBeUndefined()
        })

        it('replaces the field when only the radio layout changes', () => {
            const input = (desktop: string) =>
                baseInput(
                    stageMetadata([
                        dataElement('a', {
                            options: options('x', 'y'),
                            renderType: { desktop },
                        }),
                    ])
                )
            const first = buildFormModel(
                undefined,
                input('VERTICAL_RADIOBUTTONS')
            )
            const second = buildFormModel(
                first,
                input('HORIZONTAL_RADIOBUTTONS')
            )
            expect(second.fields.get('a')).not.toBe(first.fields.get('a'))
        })
    })

    it('an unsupported value type is read-only', () => {
        const metadata = stageMetadata([
            dataElement('a', { valueType: 'IMAGE' }),
        ])
        const field = buildFormModel(
            undefined,
            baseInput(metadata, { effective: { a: 'file' } })
        ).fields.get('a')
        expect(field).toMatchObject({
            kind: 'unsupported',
            unsupported: true,
            disabled: true,
            value: 'file',
            unsupportedReason: 'valueType',
        })
    })

    describe('performance', () => {
        it('500-field build stays under 5 ms', () => {
            const elements = Array.from({ length: 500 }, (_, index) =>
                dataElement(`de${index}`, {
                    valueType: index % 3 === 0 ? 'INTEGER' : 'TEXT',
                    ...(index % 5 === 0 && { options: options('x', 'y', 'z') }),
                })
            )
            const metadata = stageMetadata(elements)
            const effects = emptyEffects()
            effects.hiddenFields.set('de1', [attribution()])
            effects.messages.set('de2', [
                { kind: 'warning', text: 'W', by: attribution() },
            ])
            const effective: Record<string, string> = {}
            for (let index = 0; index < 500; index += 2) {
                effective[`de${index}`] = index % 5 === 0 ? 'x' : '1'
            }
            let model = buildFormModel(
                undefined,
                baseInput(metadata, { effects, effective })
            )

            const run = (round: number) => {
                const start = performance.now()
                model = buildFormModel(
                    model,
                    baseInput(metadata, {
                        effects,
                        effective: { ...effective, de3: String(round) },
                    })
                )
                return performance.now() - start
            }
            for (let round = 0; round < 10; round += 1) {
                run(round)
            }
            const timings = Array.from({ length: 20 }, (_, round) =>
                run(round + 100)
            ).sort((a, b) => a - b)
            const median = (timings[9] + timings[10]) / 2
            expect(median).toBeLessThan(5)
        })
    })
})
