import { describe, expect, it } from 'vitest'
import { hivProgram } from '../__tests__/fixtures/program'
import { fieldSchema, errorCodeOf } from './fieldSchema'
import { attributeOf, buildProgramModel } from './programModel'
import type { FieldValue, FormField } from './types'

const model = buildProgramModel(hivProgram)

const schemaFor = (id: string, match: FormField['match'] = 'exact') => {
    const attribute = attributeOf(model, id)
    if (!attribute) {
        throw new Error(`No ${id} in the test program`)
    }
    return fieldSchema(attribute, match)
}

const errorFor = (
    id: string,
    value: FieldValue,
    match: FormField['match'] = 'exact'
) => {
    const result = schemaFor(id, match).safeParse(value)
    return result.success ? undefined : errorCodeOf(result.error)
}

describe('fieldSchema', () => {
    it('turns a value into the conditions it sends', () => {
        expect(
            schemaFor('firstName').parse({ kind: 'text', text: '  Jo ' })
        ).toEqual([{ op: 'like', value: 'Jo' }])
        expect(
            schemaFor('weight', 'range').parse({
                kind: 'numberRange',
                min: '60',
                max: '',
            })
        ).toEqual([{ op: 'ge', value: '60' }])
    })

    it('reads a blank value, no value or a value of another kind as empty', () => {
        expect(
            schemaFor('firstName').parse({ kind: 'text', text: '  ' })
        ).toBeUndefined()
        expect(schemaFor('firstName').parse(undefined)).toBeUndefined()
        expect(
            schemaFor('firstName').parse({ kind: 'number', value: '5' })
        ).toBeUndefined()
    })

    it('reports each error code as its message', () => {
        expect(errorFor('weight', { kind: 'number', value: '7.5' })).toBe(
            'not-integer'
        )
        expect(errorFor('weight', { kind: 'number', value: 'abc' })).toBe(
            'invalid-number'
        )
        expect(errorFor('dob', { kind: 'date', date: '2001-02-30' })).toBe(
            'invalid-date'
        )
        expect(
            errorFor(
                'weight',
                { kind: 'numberRange', min: '80', max: '60' },
                'range'
            )
        ).toBe('reversed')
    })
})
