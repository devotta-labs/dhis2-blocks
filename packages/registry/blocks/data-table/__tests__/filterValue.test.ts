import {
    dataTableFilterValueSchema,
    isDataTableFilterValueEmpty,
    parseDataTableFilterValue,
    type DataTableFilterValue,
} from '..'

const valid: DataTableFilterValue[] = [
    { kind: 'text', operator: 'contains', text: 'Amina' },
    { kind: 'text', operator: 'equals', text: '' },
    { kind: 'text', operator: 'startsWith', text: 'A' },
    { kind: 'text', operator: 'empty', text: '' },
    { kind: 'text', operator: 'notEmpty', text: '' },
    { kind: 'number' },
    { kind: 'number', min: 0, max: 120 },
    { kind: 'number', min: -1.5 },
    { kind: 'date' },
    { kind: 'date', from: '2024-01-01', to: '2024-12-31' },
    { kind: 'options', values: [] },
    { kind: 'options', values: ['Bo', 'Kenema'] },
    { kind: 'boolean', value: true },
    { kind: 'boolean', value: false },
    { kind: 'custom', value: '' },
    { kind: 'custom', value: 'last-30-days' },
]

describe('parseDataTableFilterValue', () => {
    it.each(valid)('accepts %j', (value) => {
        expect(parseDataTableFilterValue({ id: 'column', value })).toEqual(
            value
        )
    })

    it.each([
        undefined,
        null,
        'Amina',
        42,
        ['Bo'],
        {},
        { kind: 'colour', value: 'red' },
        { kind: 'text', text: 'Amina' },
        { kind: 'text', operator: 'endsWith', text: 'a' },
        { kind: 'text', operator: 'contains' },
        { kind: 'number', min: '10' },
        { kind: 'number', min: Number.POSITIVE_INFINITY },
        { kind: 'number', max: Number.NaN },
        { kind: 'date', from: '2024-1-1' },
        { kind: 'date', to: '01/02/2024' },
        { kind: 'date', from: '2024-01-01T00:00' },
        { kind: 'options', values: 'Bo' },
        { kind: 'options', values: [1, 2] },
        { kind: 'boolean', value: 'true' },
        { kind: 'custom', value: 7 },
    ])('rejects %j', (value) => {
        expect(parseDataTableFilterValue({ id: 'column', value })).toBe(
            undefined
        )
    })

    it('matches the schema', () => {
        for (const value of valid) {
            expect(dataTableFilterValueSchema.safeParse(value).success).toBe(
                true
            )
        }
    })
})

describe('isDataTableFilterValueEmpty', () => {
    it.each<[DataTableFilterValue, boolean]>([
        [{ kind: 'text', operator: 'contains', text: '' }, true],
        [{ kind: 'text', operator: 'equals', text: '   ' }, true],
        [{ kind: 'text', operator: 'startsWith', text: 'a' }, false],
        [{ kind: 'text', operator: 'empty', text: '' }, false],
        [{ kind: 'text', operator: 'notEmpty', text: '' }, false],
        [{ kind: 'number' }, true],
        [{ kind: 'number', min: 0 }, false],
        [{ kind: 'number', max: 0 }, false],
        [{ kind: 'date' }, true],
        [{ kind: 'date', from: '2024-01-01' }, false],
        [{ kind: 'date', to: '2024-01-01' }, false],
        [{ kind: 'options', values: [] }, true],
        [{ kind: 'options', values: ['Bo'] }, false],
        [{ kind: 'boolean', value: false }, false],
        [{ kind: 'boolean', value: true }, false],
        [{ kind: 'custom', value: '' }, true],
        [{ kind: 'custom', value: 'x' }, false],
    ])('%j is empty: %s', (value, empty) => {
        expect(isDataTableFilterValueEmpty(value)).toBe(empty)
    })
})
