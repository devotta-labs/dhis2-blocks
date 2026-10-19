import {
    attribution,
    dataElement,
    emptyEffects,
    stageMetadata,
} from './__fixtures__/builders'
import { buildFormModel, type BuildFormModelInput } from './buildFormModel'

const input = (formText?: string): BuildFormModelInput => {
    const effects = emptyEffects()
    if (formText !== undefined) {
        effects.messages.set('form', [
            { kind: 'error', text: formText, by: attribution() },
        ])
    }
    return {
        metadata: stageMetadata([dataElement('a'), dataElement('b')]),
        effective: {},
        stored: {},
        effects,
        optionGroupOptions: new Map(),
        fieldErrors: {},
        showAllErrors: false,
        isCompleting: false,
    }
}

describe('buildFormModel form-level messages', () => {
    it('holds the rule messages about the whole event, none without effects', () => {
        expect(buildFormModel(undefined, input()).formMessages).toEqual([])
        expect(
            buildFormModel(undefined, input('Whole event')).formMessages.map(
                (message) => message.text
            )
        ).toEqual(['Whole event'])
    })

    it('keeps the model while their content is unchanged, and only them when it changes', () => {
        const first = buildFormModel(undefined, input('Whole event'))
        expect(buildFormModel(first, input('Whole event'))).toBe(first)
        const changed = buildFormModel(first, input('Something else'))
        expect(changed).not.toBe(first)
        expect(changed.fields.get('a')).toBe(first.fields.get('a'))
        expect(changed.sections).toBe(first.sections)
        expect(changed.formMessages[0]?.text).toBe('Something else')
    })
})
