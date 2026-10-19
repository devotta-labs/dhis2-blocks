import { attribution, emptyEffects } from './__fixtures__/builders'
import { overlay, type RuleChange } from './overlay'

describe('overlay', () => {
    it('returns the stored values untouched without effects', () => {
        const stored = { a: 'x' }
        const result = overlay(stored, undefined)
        expect(result.effective).toBe(stored)
        expect(result.ruleChanges).toEqual([])
    })

    it('hidden answered field is cleared, then restored when shown again', () => {
        const stored = { a: 'x', b: 'y' }
        const by = attribution()
        const hiding = emptyEffects()
        hiding.hiddenFields.set('a', [by])

        const hidden = overlay(stored, hiding)
        expect(hidden.effective).toEqual({ b: 'y' })
        expect(hidden.effective.a).toBeUndefined()
        const cleared: RuleChange[] = [
            { fieldId: 'a', kind: 'cleared', from: 'x', to: undefined, by },
        ]
        expect(hidden.ruleChanges).toEqual(cleared)
        // The overlay never writes into stored values.
        expect(stored).toEqual({ a: 'x', b: 'y' })

        const shown = overlay(stored, emptyEffects())
        expect(shown.effective.a).toBe('x')
        expect(shown.ruleChanges).toEqual([])
    })

    it('hidden field without a stored value records no change', () => {
        const effects = emptyEffects()
        effects.hiddenFields.set('a', [attribution()])
        expect(overlay({ b: 'y' }, effects).ruleChanges).toEqual([])
    })

    it('assign overrides stored and records from/to', () => {
        const by = attribution()
        const effects = emptyEffects()
        effects.assignedValues.set('a', { value: 'new', by })
        effects.assignedValues.set('b', { value: '5', by })

        const result = overlay({ a: 'old' }, effects)
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
        const result = overlay({ a: 'same' }, effects)
        expect(result.effective).toEqual({ a: 'same' })
        expect(result.ruleChanges).toEqual([])
    })

    it('assign null clears', () => {
        const by = attribution()
        const effects = emptyEffects()
        effects.assignedValues.set('a', { value: null, by })
        effects.assignedValues.set('b', { value: null, by })

        const result = overlay({ a: 'x' }, effects)
        expect(result.effective).toEqual({})
        expect(result.ruleChanges).toEqual([
            { fieldId: 'a', kind: 'cleared', from: 'x', to: undefined, by },
        ])
    })

    it('a hidden field is not assigned', () => {
        const effects = emptyEffects()
        effects.hiddenFields.set('a', [attribution('hide')])
        effects.assignedValues.set('a', {
            value: 'v',
            by: attribution('assign'),
        })
        const result = overlay({}, effects)
        expect(result.effective).toEqual({})
        expect(result.ruleChanges).toEqual([])
    })
})
