import { describe, expect, it } from 'vitest'
import type { AttributeMetadata } from '../api/schemas'
import { hivProgram } from '../__tests__/fixtures/program'
import { evaluateForm, findRangeConflicts } from './evaluateForm'
import { buildProgramModel } from './programModel'
import type { FieldValue, FormField } from './types'

const model = buildProgramModel(hivProgram)

const exact = (...ids: string[]): FormField[] =>
    ids.map((attribute) => ({ attribute, match: 'exact' }))
const range = (attribute: string): FormField => ({ attribute, match: 'range' })
const text = (value: string): FieldValue => ({ kind: 'text', text: value })
const date = (value: string): FieldValue => ({ kind: 'date', date: value })

const withAttributes = (...extra: AttributeMetadata[]) =>
    buildProgramModel({
        ...hivProgram,
        attributes: [...hivProgram.attributes, ...extra],
    })

describe('evaluateForm', () => {
    it('searches a filled ID alone with an exact match', () => {
        const verdict = evaluateForm(
            model,
            exact('artNumber', 'firstName', 'dob'),
            { artNumber: text('  ART-1  '), firstName: text('Am') }
        )
        expect(verdict.reason).toBe('ready')
        expect(verdict.searchingBy).toBe('artNumber')
        expect(verdict.dropped).toBe(1)
        expect(verdict.problems).toEqual([])
        expect(verdict.search?.filters).toEqual([
            {
                attribute: 'artNumber',
                conditions: [{ op: 'eq', value: 'ART-1' }],
            },
        ])
    })

    it('keeps pasted ID punctuation and still matches exactly', () => {
        const verdict = evaluateForm(model, exact('artNumber'), {
            artNumber: text(' a:b,c/d '),
        })
        expect(verdict.search?.filters).toEqual([
            {
                attribute: 'artNumber',
                conditions: [{ op: 'eq', value: 'a:b,c/d' }],
            },
        ])
    })

    it('refuses two IDs at once', () => {
        const twoIds = withAttributes({
            id: 'nationalId',
            label: 'National ID',
            valueType: 'TEXT',
            unique: true,
            searchable: true,
            displayInList: false,
            blockedSearchOperators: [],
            minCharactersToSearch: 0,
        })
        const verdict = evaluateForm(twoIds, exact('artNumber', 'nationalId'), {
            artNumber: text('ART-1'),
            nationalId: text('N-1'),
        })
        expect(verdict.reason).toBe('two-ids')
        expect(verdict.search?.filters).toBeUndefined()
        expect(verdict.searchingBy).toBeUndefined()
    })

    it('needs the minimum of details without an ID', () => {
        const fields = exact('artNumber', 'firstName', 'dob')
        const one = evaluateForm(model, fields, { firstName: text('Am') })
        expect(one.reason).toBe('needs-more')
        expect(one.missing).toBe(1)
        expect(one.search?.filters).toBeUndefined()

        const two = evaluateForm(model, fields, {
            firstName: text(' Am '),
            dob: date('2000-01-02'),
        })
        expect(two.reason).toBe('ready')
        expect(two.missing).toBe(0)
        expect(two.searchingBy).toBeUndefined()
        expect(two.search?.filters).toEqual([
            {
                attribute: 'firstName',
                conditions: [{ op: 'like', value: 'Am' }],
            },
            {
                attribute: 'dob',
                conditions: [{ op: 'eq', value: '2000-01-02' }],
            },
        ])
    })

    it('reports an empty form, counting blank and unknown values as empty', () => {
        const verdict = evaluateForm(model, exact('firstName', 'sex', 'dob'), {
            firstName: text('   '),
            sex: { kind: 'option', code: 'X' },
            dob: { kind: 'date' },
        })
        expect(verdict.reason).toBe('empty')
        expect(verdict.missing).toBe(2)
        expect(verdict.search?.filters).toBeUndefined()
    })

    it('sends options, booleans and true-only as exact matches', () => {
        const flags = withAttributes(
            {
                id: 'pregnant',
                label: 'Pregnant',
                valueType: 'BOOLEAN',
                unique: false,
                searchable: true,
                displayInList: false,
                blockedSearchOperators: [],
                minCharactersToSearch: 0,
            },
            {
                id: 'consent',
                label: 'Consent',
                valueType: 'TRUE_ONLY',
                unique: false,
                searchable: true,
                displayInList: false,
                blockedSearchOperators: [],
                minCharactersToSearch: 0,
            }
        )
        const verdict = evaluateForm(
            flags,
            exact('sex', 'pregnant', 'consent'),
            {
                sex: { kind: 'option', code: 'F' },
                pregnant: { kind: 'boolean', value: 'false' },
                consent: { kind: 'trueOnly', checked: true },
            }
        )
        expect(verdict.reason).toBe('ready')
        expect(verdict.search?.filters).toEqual([
            { attribute: 'sex', conditions: [{ op: 'eq', value: 'F' }] },
            {
                attribute: 'pregnant',
                conditions: [{ op: 'eq', value: 'false' }],
            },
            { attribute: 'consent', conditions: [{ op: 'eq', value: 'true' }] },
        ])

        const unchecked = evaluateForm(flags, exact('sex', 'consent'), {
            sex: { kind: 'option', code: 'F' },
            consent: { kind: 'trueOnly', checked: false },
        })
        expect(unchecked.reason).toBe('needs-more')
    })

    it('counts a one-sided range as filled', () => {
        const verdict = evaluateForm(
            model,
            [...exact('firstName'), range('dob')],
            {
                firstName: text('Am'),
                dob: { kind: 'dateRange', from: '2000-01-01' },
            }
        )
        expect(verdict.reason).toBe('ready')
        expect(verdict.search?.filters).toEqual([
            {
                attribute: 'firstName',
                conditions: [{ op: 'like', value: 'Am' }],
            },
            {
                attribute: 'dob',
                conditions: [{ op: 'ge', value: '2000-01-01' }],
            },
        ])

        const numbers = evaluateForm(
            model,
            [...exact('firstName'), range('weight')],
            {
                firstName: text('Am'),
                weight: { kind: 'numberRange', min: ' 40 ', max: '80' },
            }
        )
        expect(numbers.search?.filters[1]).toEqual({
            attribute: 'weight',
            conditions: [
                { op: 'ge', value: '40' },
                { op: 'le', value: '80' },
            ],
        })
    })

    it('sends numbers exactly as typed, without losing precision', () => {
        const big = withAttributes({
            id: 'cardNumber',
            label: 'Card number',
            valueType: 'NUMBER',
            unique: false,
            searchable: true,
            displayInList: false,
            blockedSearchOperators: [],
            minCharactersToSearch: 0,
        })
        const exactValue = evaluateForm(big, exact('firstName', 'cardNumber'), {
            firstName: text('Am'),
            cardNumber: { kind: 'number', value: ' 12345678901234567890 ' },
        })
        expect(exactValue.search?.filters[1]).toEqual({
            attribute: 'cardNumber',
            conditions: [{ op: 'eq', value: '12345678901234567890' }],
        })

        const bounds = evaluateForm(
            big,
            [...exact('firstName'), range('cardNumber')],
            {
                firstName: text('Am'),
                cardNumber: {
                    kind: 'numberRange',
                    min: '12345678901234567890',
                    max: '+12345678901234567899.50',
                },
            }
        )
        expect(bounds.search?.filters[1]).toEqual({
            attribute: 'cardNumber',
            conditions: [
                { op: 'ge', value: '12345678901234567890' },
                { op: 'le', value: '+12345678901234567899.50' },
            ],
        })
    })

    it('sends a datetime day as ge/le bounds', () => {
        const day = evaluateForm(model, exact('firstName', 'visit'), {
            firstName: text('Am'),
            visit: date('2024-03-05'),
        })
        expect(day.reason).toBe('ready')
        expect(day.search?.filters).toEqual([
            {
                attribute: 'firstName',
                conditions: [{ op: 'like', value: 'Am' }],
            },
            {
                attribute: 'visit',
                conditions: [
                    { op: 'ge', value: '2024-03-05T00:00:00.000' },
                    { op: 'le', value: '2024-03-05T23:59:59.999' },
                ],
            },
        ])

        const span = evaluateForm(
            model,
            [...exact('firstName'), range('visit')],
            {
                firstName: text('Am'),
                visit: {
                    kind: 'dateRange',
                    from: '2024-03-01',
                    to: '2024-03-05',
                },
            }
        )
        expect(span.search?.filters[1]).toEqual({
            attribute: 'visit',
            conditions: [
                { op: 'ge', value: '2024-03-01T00:00:00.000' },
                { op: 'le', value: '2024-03-05T23:59:59.999' },
            ],
        })
    })

    it('flags short text, decimals in integers, bad dates and reversed ranges as issues and blocks search', () => {
        const verdict = evaluateForm(
            model,
            [
                ...exact('artNumber', 'firstName', 'weight', 'dob'),
                range('visit'),
            ],
            {
                artNumber: text('ART-1'),
                firstName: text(' A '),
                weight: { kind: 'number', value: '61.5' },
                dob: date('2000-02-30'),
                visit: {
                    kind: 'dateRange',
                    from: '2024-03-05',
                    to: '2024-03-01',
                },
            }
        )
        expect(verdict.reason).toBe('has-issues')
        expect(verdict.issues).toEqual({
            firstName: 'too-short',
            weight: 'not-integer',
            dob: 'invalid-date',
            visit: 'reversed',
        })
        expect(verdict.search?.filters).toBeUndefined()

        const more = evaluateForm(
            model,
            [...exact('firstName', 'weight'), range('dob')],
            {
                firstName: text('Ama'),
                weight: { kind: 'number', value: '12kg' },
                dob: { kind: 'dateRange', from: '02/01/2000' },
            }
        )
        expect(more.reason).toBe('has-issues')
        expect(more.issues).toEqual({
            weight: 'invalid-number',
            dob: 'invalid-date',
        })

        const reversedNumbers = evaluateForm(
            model,
            [...exact('firstName'), range('weight')],
            {
                firstName: text('Ama'),
                weight: { kind: 'numberRange', min: '80', max: '9' },
            }
        )
        expect(reversedNumbers.issues).toEqual({ weight: 'reversed' })
    })

    it('flags a too-short unique text value', () => {
        const shortId = withAttributes({
            id: 'nationalId',
            label: 'National ID',
            valueType: 'TEXT',
            unique: true,
            searchable: true,
            displayInList: false,
            blockedSearchOperators: [],
            minCharactersToSearch: 4,
        })
        const verdict = evaluateForm(shortId, exact('nationalId'), {
            nationalId: text('N1'),
        })
        expect(verdict.reason).toBe('has-issues')
        expect(verdict.issues).toEqual({ nationalId: 'too-short' })
    })

    it('reports non-searchable, unknown, unsupported and fully blocked fields and leaves them out', () => {
        const verdict = evaluateForm(
            model,
            exact('legacyId', 'nope', 'photo', 'nickname', 'firstName', 'dob'),
            {
                legacyId: text('L-1'),
                nope: text('secret'),
                photo: text('img'),
                nickname: text('Ace'),
                firstName: text('Am'),
                dob: date('2000-01-02'),
            }
        )
        expect(verdict.problems).toEqual([
            { kind: 'not-searchable', attribute: 'legacyId' },
            { kind: 'unknown-attribute', attribute: 'nope' },
            { kind: 'unsupported-type', attribute: 'photo' },
            { kind: 'operators-blocked', attribute: 'nickname' },
        ])
        expect(verdict.reason).toBe('ready')
        expect(verdict.searchingBy).toBeUndefined()
        expect(verdict.search?.filters).toEqual([
            {
                attribute: 'firstName',
                conditions: [{ op: 'like', value: 'Am' }],
            },
            {
                attribute: 'dob',
                conditions: [{ op: 'eq', value: '2000-01-02' }],
            },
        ])
    })

    it('reports a field whose operator for its match is blocked', () => {
        const blocked = withAttributes(
            {
                id: 'enrolled',
                label: 'Enrolled',
                valueType: 'DATE',
                unique: false,
                searchable: true,
                displayInList: false,
                blockedSearchOperators: ['eq'],
                minCharactersToSearch: 0,
            },
            {
                id: 'height',
                label: 'Height',
                valueType: 'NUMBER',
                unique: false,
                searchable: true,
                displayInList: false,
                blockedSearchOperators: ['ge', 'le'],
                minCharactersToSearch: 0,
            }
        )
        const verdict = evaluateForm(
            blocked,
            [...exact('enrolled', 'firstName', 'dob'), range('height')],
            {}
        )
        expect(verdict.problems).toEqual([
            { kind: 'operators-blocked', attribute: 'enrolled' },
            { kind: 'operators-blocked', attribute: 'height' },
        ])
        // The other match stays usable.
        const otherMatches = evaluateForm(
            blocked,
            [range('enrolled'), ...exact('height')],
            {}
        )
        expect(otherMatches.problems).toEqual([])
    })

    it('reports a form that can never search', () => {
        const verdict = evaluateForm(model, exact('firstName'), {
            firstName: text('Amina'),
        })
        expect(verdict.problems).toEqual([{ kind: 'form-cannot-search' }])
        expect(verdict.reason).toBe('not-set-up')
        expect(verdict.search?.filters).toBeUndefined()

        const onlyBad = evaluateForm(model, exact('legacyId', 'nope'), {})
        expect(onlyBad.problems).toContainEqual({ kind: 'form-cannot-search' })
        expect(onlyBad.reason).toBe('not-set-up')

        // A usable ID is always enough to search.
        expect(evaluateForm(model, exact('artNumber'), {}).reason).toBe('empty')
    })

    it('rejects a range on an ID or text field', () => {
        const verdict = evaluateForm(
            model,
            [
                range('artNumber'),
                range('firstName'),
                range('sex'),
                ...exact('dob', 'weight'),
            ],
            {
                artNumber: { kind: 'dateRange', from: '2000-01-01' },
                dob: date('2000-01-02'),
                weight: { kind: 'number', value: '60' },
            }
        )
        expect(verdict.problems).toEqual([
            { kind: 'range-not-supported', attribute: 'artNumber' },
            { kind: 'range-not-supported', attribute: 'firstName' },
            { kind: 'range-not-supported', attribute: 'sex' },
        ])
        expect(verdict.reason).toBe('ready')
        expect(verdict.search?.filters.map((f) => f.attribute)).toEqual([
            'dob',
            'weight',
        ])
    })

    it('treats a value of the wrong kind as empty', () => {
        const verdict = evaluateForm(model, exact('firstName', 'dob'), {
            firstName: text('Am'),
            dob: { kind: 'dateRange', from: '2000-01-01' },
        })
        expect(verdict.reason).toBe('needs-more')
    })

    it('reads only values the form holds, not inherited keys', () => {
        const inherited = withAttributes({
            id: 'constructor',
            label: 'Odd uid',
            valueType: 'TEXT',
            unique: false,
            searchable: true,
            displayInList: false,
            blockedSearchOperators: [],
            minCharactersToSearch: 0,
        })
        const verdict = evaluateForm(
            inherited,
            exact('firstName', 'constructor'),
            { firstName: text('Am') }
        )
        expect(verdict.reason).toBe('needs-more')
    })

    it('finds an attribute composed both exact and as a range', () => {
        const fields = [
            ...exact('dob', 'firstName', 'weight'),
            range('dob'),
            range('visit'),
            range('dob'),
        ]
        expect(findRangeConflicts(fields)).toEqual(['dob'])
        expect(findRangeConflicts(exact('dob', 'dob'))).toEqual([])

        const verdict = evaluateForm(model, fields, {
            firstName: text('Am'),
            weight: { kind: 'number', value: '60' },
            dob: date('2000-01-02'),
        })
        expect(verdict.problems).toEqual([
            { kind: 'shape-conflict', attribute: 'dob' },
        ])
        expect(verdict.search?.filters.map((f) => f.attribute)).toEqual([
            'firstName',
            'weight',
        ])
    })

    it('freezes the verdict and the search all the way down', () => {
        const verdict = evaluateForm(
            model,
            exact('firstName', 'visit', 'nope'),
            {
                firstName: text('Am'),
                visit: date('2024-03-05'),
            }
        )
        const search = verdict.search
        expect(search).toBeDefined()
        expect(Object.isFrozen(verdict)).toBe(true)
        expect(Object.isFrozen(verdict.problems)).toBe(true)
        expect(verdict.problems.every(Object.isFrozen)).toBe(true)
        expect(Object.isFrozen(verdict.issues)).toBe(true)
        expect(Object.isFrozen(search)).toBe(true)
        expect(Object.isFrozen(search?.filters)).toBe(true)
        for (const filter of search?.filters ?? []) {
            expect(Object.isFrozen(filter)).toBe(true)
            expect(Object.isFrozen(filter.conditions)).toBe(true)
            expect(filter.conditions.every(Object.isFrozen)).toBe(true)
        }
    })
})

describe('integer values', () => {
    it.each(['1.0', '9007199254740993.5', '2.', '.0'])(
        'rejects %s for an INTEGER attribute',
        (value) => {
            const verdict = evaluateForm(model, exact('firstName', 'weight'), {
                firstName: text('Ama'),
                weight: { kind: 'number', value },
            })
            expect(verdict.issues).toEqual({ weight: 'not-integer' })
        }
    )

    it.each(['61', '+61', '-3', '007'])(
        'accepts %s for an INTEGER attribute and sends it as typed',
        (value) => {
            const verdict = evaluateForm(model, exact('firstName', 'weight'), {
                firstName: text('Ama'),
                weight: { kind: 'number', value },
            })
            expect(verdict.issues).toEqual({})
            expect(verdict.search?.filters[1]).toEqual({
                attribute: 'weight',
                conditions: [{ op: 'eq', value }],
            })
        }
    )
})
