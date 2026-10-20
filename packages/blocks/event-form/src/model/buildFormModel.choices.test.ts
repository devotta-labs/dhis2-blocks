import type { DataElementMeta } from '../api/schemas'
import {
    baseInput,
    dataElement,
    emptyEffects,
    options,
    stageMetadata,
    threeFields,
} from './__fixtures__/builders'
import { buildFormModel, type BuildFormModelInput } from './buildFormModel'

describe('buildFormModel', () => {
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
})
