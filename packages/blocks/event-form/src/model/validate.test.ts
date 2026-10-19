import type { ValueError } from './valueTypes'
import {
    attribution,
    dataElement,
    emptyEffects,
    stageMetadata,
} from './__fixtures__/builders'
import { buildFormModel, type FormModel } from './buildFormModel'
import { validateForm } from './validate'

type Strategy = 'NONE' | 'ON_COMPLETE' | 'ON_UPDATE_AND_INSERT'

const typeError: ValueError = {
    code: 'integer',
    message: 'Enter a whole number',
}

const buildFixture = (): FormModel => {
    const metadata = stageMetadata([
        dataElement('typeErr', { valueType: 'INTEGER' }),
        dataElement('ruleErr'),
        dataElement('eoc'),
        dataElement('metaRequired', { compulsory: true }),
        dataElement('ruleMandatory'),
        dataElement('hiddenErr', { compulsory: true }),
        dataElement('unsupportedMandatory', {
            valueType: 'IMAGE',
            compulsory: true,
        }),
        dataElement('fine'),
    ])
    const by = attribution()
    const effects = emptyEffects()
    effects.messages.set('ruleErr', [{ kind: 'error', text: 'Nope', by }])
    effects.messages.set('eoc', [
        { kind: 'errorOnComplete', text: 'Fix before completing', by },
    ])
    effects.messages.set('hiddenErr', [{ kind: 'error', text: 'Nope', by }])
    effects.mandatoryFields.set('ruleMandatory', [by])
    effects.hiddenFields.set('hiddenErr', [by])
    return buildFormModel(undefined, {
        metadata,
        effective: { typeErr: 'abc', fine: 'ok' },
        stored: { typeErr: 'abc', fine: 'ok' },
        effects,
        optionGroupOptions: new Map(),
        fieldErrors: { typeErr: typeError, hiddenErr: typeError },
        showAllErrors: false,
        isCompleting: false,
    })
}

const CASES: [Strategy, boolean, string[]][] = [
    ['NONE', false, ['typeErr']],
    ['NONE', true, ['typeErr', 'unsupportedMandatory']],
    ['ON_COMPLETE', false, ['typeErr']],
    [
        'ON_COMPLETE',
        true,
        [
            'typeErr',
            'ruleErr',
            'eoc',
            'metaRequired',
            'ruleMandatory',
            'unsupportedMandatory',
        ],
    ],
    [
        'ON_UPDATE_AND_INSERT',
        false,
        [
            'typeErr',
            'ruleErr',
            'metaRequired',
            'ruleMandatory',
            'unsupportedMandatory',
        ],
    ],
    [
        'ON_UPDATE_AND_INSERT',
        true,
        [
            'typeErr',
            'ruleErr',
            'eoc',
            'metaRequired',
            'ruleMandatory',
            'unsupportedMandatory',
        ],
    ],
]

describe('validateForm', () => {
    it.each(CASES)(
        '%s, completing=%s',
        (strategy, isCompleting, failedFieldIds) => {
            const result = validateForm(buildFixture(), {
                strategy,
                isCompleting,
            })
            expect(result.failedFieldIds).toEqual(failedFieldIds)
            expect(result.isValid).toBe(false)
        }
    )

    it('is valid when nothing fails', () => {
        const model = buildFormModel(undefined, {
            metadata: stageMetadata([dataElement('a', { compulsory: true })]),
            effective: { a: 'x' },
            stored: { a: 'x' },
            effects: emptyEffects(),
            optionGroupOptions: new Map(),
            fieldErrors: {},
            showAllErrors: false,
            isCompleting: true,
        })
        expect(
            validateForm(model, {
                strategy: 'ON_UPDATE_AND_INSERT',
                isCompleting: true,
            })
        ).toEqual({ isValid: true, failedFieldIds: [] })
    })

    it('does not block on a mandatory unsupported field that has a value', () => {
        const model = buildFormModel(undefined, {
            metadata: stageMetadata([
                dataElement('a', { valueType: 'IMAGE', compulsory: true }),
            ]),
            effective: { a: 'file' },
            stored: { a: 'file' },
            effects: emptyEffects(),
            optionGroupOptions: new Map(),
            fieldErrors: {},
            showAllErrors: false,
            isCompleting: true,
        })
        expect(
            validateForm(model, {
                strategy: 'ON_COMPLETE',
                isCompleting: true,
            }).isValid
        ).toBe(true)
    })
})
