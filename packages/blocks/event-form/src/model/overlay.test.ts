import type { DataElementMeta } from '../api/schemas'
import { attribution, dataElement, emptyEffects } from './__fixtures__/builders'
import { overlay, type RuleChange } from './overlay'

const stage = (...elements: DataElementMeta[]) =>
    new Map(elements.map((element) => [element.id, element]))

const fields = stage(dataElement('a'), dataElement('b'))

const YES_NO = [
    { id: 'o-yes', code: 'yes', label: 'Yes' },
    { id: 'o-no', code: 'no', label: 'No' },
]

describe('overlay', () => {
    it('returns the stored values untouched without effects', () => {
        const stored = { a: 'x' }
        const result = overlay(stored, undefined, fields)
        expect(result.effective).toBe(stored)
        expect(result.ruleChanges).toEqual([])
    })

    it('hidden answered field is cleared, then restored when shown again', () => {
        const stored = { a: 'x', b: 'y' }
        const by = attribution()
        const hiding = emptyEffects()
        hiding.hiddenFields.set('a', [by])

        const hidden = overlay(stored, hiding, fields)
        expect(hidden.effective).toEqual({ b: 'y' })
        expect(hidden.effective.a).toBeUndefined()
        const cleared: RuleChange[] = [
            { fieldId: 'a', kind: 'cleared', from: 'x', to: undefined, by },
        ]
        expect(hidden.ruleChanges).toEqual(cleared)
        // The overlay never writes into stored values.
        expect(stored).toEqual({ a: 'x', b: 'y' })

        const shown = overlay(stored, emptyEffects(), fields)
        expect(shown.effective.a).toBe('x')
        expect(shown.ruleChanges).toEqual([])
    })

    it('hidden field without a stored value records no change', () => {
        const effects = emptyEffects()
        effects.hiddenFields.set('a', [attribution()])
        expect(overlay({ b: 'y' }, effects, fields).ruleChanges).toEqual([])
    })

    it('assign overrides stored and records from/to', () => {
        const by = attribution()
        const effects = emptyEffects()
        effects.assignedValues.set('a', { value: 'new', by })
        effects.assignedValues.set('b', { value: '5', by })

        const result = overlay({ a: 'old' }, effects, fields)
        expect(result.effective).toEqual({ a: 'new', b: '5' })
        expect(result.ruleChanges).toEqual([
            { fieldId: 'a', kind: 'assigned', from: 'old', to: 'new', by },
            { fieldId: 'b', kind: 'assigned', from: undefined, to: '5', by },
        ])
    })

    it('assign equal to stored records no change', () => {
        const effects = emptyEffects()
        effects.assignedValues.set('a', {
            value: 'same',
            by: attribution(),
        })
        const result = overlay({ a: 'same' }, effects, fields)
        expect(result.effective).toEqual({ a: 'same' })
        expect(result.ruleChanges).toEqual([])
    })

    it('assign null clears', () => {
        const by = attribution()
        const effects = emptyEffects()
        effects.assignedValues.set('a', { value: null, by })
        effects.assignedValues.set('b', { value: null, by })

        const result = overlay({ a: 'x' }, effects, fields)
        expect(result.effective).toEqual({})
        expect(result.ruleChanges).toEqual([
            { fieldId: 'a', kind: 'cleared', from: 'x', to: undefined, by },
        ])
    })

    it('a hidden field still gets its assigned value', () => {
        const assign = attribution('assign')
        const effects = emptyEffects()
        effects.hiddenFields.set('a', [attribution('hide')])
        effects.assignedValues.set('a', { value: 'v', by: assign })
        const result = overlay({ a: 'typed' }, effects, fields)
        expect(result.effective).toEqual({ a: 'v' })
        expect(result.ruleChanges).toEqual([
            {
                fieldId: 'a',
                kind: 'assigned',
                from: 'typed',
                to: 'v',
                by: assign,
            },
        ])
    })

    it('a hidden field assigned null is cleared', () => {
        const assign = attribution('assign')
        const effects = emptyEffects()
        effects.hiddenFields.set('a', [attribution('hide')])
        effects.assignedValues.set('a', { value: null, by: assign })
        const result = overlay({ a: 'typed' }, effects, fields)
        expect(result.effective).toEqual({})
        expect(result.ruleChanges).toEqual([
            {
                fieldId: 'a',
                kind: 'cleared',
                from: 'typed',
                to: undefined,
                by: assign,
            },
        ])
    })

    it('an assigned code outside the option set clears the field', () => {
        const by = attribution()
        const effects = emptyEffects()
        effects.assignedValues.set('a', { value: 'unsure', by })
        effects.assignedValues.set('b', { value: 'no', by })
        const result = overlay(
            { a: 'yes' },
            effects,
            stage(
                dataElement('a', { options: YES_NO }),
                dataElement('b', { options: YES_NO })
            )
        )
        expect(result.effective).toEqual({ b: 'no' })
        expect(result.ruleChanges).toEqual([
            { fieldId: 'a', kind: 'cleared', from: 'yes', to: undefined, by },
            { fieldId: 'b', kind: 'assigned', from: undefined, to: 'no', by },
        ])
    })

    it('a MULTI_TEXT assignment needs every part to be an option code', () => {
        const effects = (value: string) => {
            const result = emptyEffects()
            result.assignedValues.set('a', { value, by: attribution() })
            return result
        }
        const multiText = stage(
            dataElement('a', { valueType: 'MULTI_TEXT', options: YES_NO })
        )
        expect(overlay({}, effects('yes,no'), multiText).effective).toEqual({
            a: 'yes,no',
        })
        expect(
            overlay({ a: 'no' }, effects('yes,unsure'), multiText).effective
        ).toEqual({})
    })

    it('an assignment to a data element outside the stage is dropped', () => {
        const effects = emptyEffects()
        effects.assignedValues.set('elsewhere', {
            value: 'x',
            by: attribution(),
        })
        const stored = { a: 'x' }
        const result = overlay(stored, effects, fields)
        expect(result.effective).toBe(stored)
        expect(result.ruleChanges).toEqual([])
    })
})
