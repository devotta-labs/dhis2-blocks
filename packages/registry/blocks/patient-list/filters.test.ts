import type { DataTableFilterValue } from '@/components/data-table'
import {
    attributeBooleanFilter,
    attributeDateFilter,
    attributeNumberFilter,
    attributeOptionsFilter,
    attributeTextFilter,
    enrollmentDateFilter,
    enrollmentStatusFilter,
    escapeFilterValue,
    toPatientListFilterQuery,
} from './filters'

const A = 'w75KJ2mc4zz'

const text = attributeTextFilter({
    attribute: A,
    label: 'First name',
    operators: ['contains', 'equals', 'startsWith', 'empty', 'notEmpty'],
})
const number = attributeNumberFilter({ attribute: A, label: 'Age' })
const date = attributeDateFilter({ attribute: A, label: 'Birth date' })
const options = attributeOptionsFilter({
    attribute: A,
    label: 'District',
    multiple: true,
    options: [
        { value: 'Bo', label: 'Bo' },
        { value: 'Kenema', label: 'Kenema' },
    ],
})
const boolean = attributeBooleanFilter({ attribute: A, label: 'Pregnant' })
const status = enrollmentStatusFilter()
const enrolled = enrollmentDateFilter({
    field: 'enrolledAt',
    label: 'Enrolled',
})
const occurred = enrollmentDateFilter({
    field: 'occurredAt',
    label: 'Incident',
})

const textValue = (
    operator: Extract<DataTableFilterValue, { kind: 'text' }>['operator'],
    value: string
): DataTableFilterValue => ({ kind: 'text', operator, text: value })

describe('filter definitions', () => {
    it('describe the data table filter they show', () => {
        expect(text).toMatchObject({ id: A, kind: 'text', label: 'First name' })
        expect(
            attributeTextFilter({
                attribute: A,
                label: 'Name',
                pinned: true,
                placeholder: 'Name or part of it',
            })
        ).toMatchObject({ pinned: true, placeholder: 'Name or part of it' })
        expect(
            attributeNumberFilter({
                attribute: A,
                label: 'Age',
                min: 0,
                max: 120,
                step: 1,
            })
        ).toMatchObject({ kind: 'number', min: 0, max: 120, step: 1 })
        expect(date).toMatchObject({ id: A, kind: 'date' })
        expect(options).toMatchObject({ kind: 'options', multiple: true })
        expect(
            attributeBooleanFilter({
                attribute: A,
                label: 'Pregnant',
                trueLabel: 'Pregnant',
                falseLabel: 'Not pregnant',
            })
        ).toMatchObject({
            kind: 'boolean',
            trueLabel: 'Pregnant',
            falseLabel: 'Not pregnant',
        })
        expect(status).toMatchObject({
            id: 'enrollmentStatus',
            kind: 'options',
            label: 'Enrollment status',
            multiple: false,
            options: [
                { value: 'ACTIVE', label: 'Active' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' },
            ],
        })
        expect(
            enrollmentStatusFilter({ label: 'Status', pinned: true })
        ).toMatchObject({ label: 'Status', pinned: true })
        expect(enrolled).toMatchObject({ id: 'enrolledAt', kind: 'date' })
        expect(occurred).toMatchObject({ id: 'occurredAt', kind: 'date' })
    })
})

describe('toQuery', () => {
    it('maps text operators', () => {
        expect(text.toQuery(textValue('contains', 'ami'))).toEqual({
            filters: [`${A}:like:ami`],
        })
        expect(text.toQuery(textValue('equals', 'Amina'))).toEqual({
            filters: [`${A}:eq:Amina`],
        })
        expect(text.toQuery(textValue('startsWith', 'Am'))).toEqual({
            filters: [`${A}:sw:Am`],
        })
        expect(text.toQuery(textValue('empty', ''))).toEqual({
            filters: [`${A}:null`],
        })
        expect(text.toQuery(textValue('notEmpty', ''))).toEqual({
            filters: [`${A}:!null`],
        })
    })

    it('escapes values', () => {
        expect(escapeFilterValue('a/b:c,d')).toBe('a//b/:c/,d')
        expect(text.toQuery(textValue('contains', '1:2,3/4'))).toEqual({
            filters: [`${A}:like:1/:2/,3//4`],
        })
        expect(
            options.toQuery({ kind: 'options', values: ['a:b', 'c,d'] })
        ).toEqual({ filters: [`${A}:in:a/:b;c/,d`] })
    })

    it('maps a number range, or the one bound that is set', () => {
        expect(number.toQuery({ kind: 'number', min: 18, max: 49 })).toEqual({
            filters: [`${A}:ge:18:le:49`],
        })
        expect(number.toQuery({ kind: 'number', min: 18 })).toEqual({
            filters: [`${A}:ge:18`],
        })
        expect(number.toQuery({ kind: 'number', max: 0 })).toEqual({
            filters: [`${A}:le:0`],
        })
        expect(number.toQuery({ kind: 'number' })).toEqual({})
    })

    it('maps a date range, or the one bound that is set', () => {
        expect(
            date.toQuery({ kind: 'date', from: '2024-01-01', to: '2024-12-31' })
        ).toEqual({ filters: [`${A}:ge:2024-01-01:le:2024-12-31`] })
        expect(date.toQuery({ kind: 'date', from: '2024-01-01' })).toEqual({
            filters: [`${A}:ge:2024-01-01`],
        })
        expect(date.toQuery({ kind: 'date', to: '2024-12-31' })).toEqual({
            filters: [`${A}:le:2024-12-31`],
        })
    })

    it('maps one option to eq and several to in', () => {
        expect(options.toQuery({ kind: 'options', values: ['Bo'] })).toEqual({
            filters: [`${A}:eq:Bo`],
        })
        expect(
            options.toQuery({ kind: 'options', values: ['Bo', 'Kenema'] })
        ).toEqual({ filters: [`${A}:in:Bo;Kenema`] })
        expect(options.toQuery({ kind: 'options', values: [] })).toEqual({})
    })

    it('maps a boolean', () => {
        expect(boolean.toQuery({ kind: 'boolean', value: true })).toEqual({
            filters: [`${A}:eq:true`],
        })
        expect(boolean.toQuery({ kind: 'boolean', value: false })).toEqual({
            filters: [`${A}:eq:false`],
        })
    })

    it('maps the enrollment status, and ignores an unknown one', () => {
        expect(status.toQuery({ kind: 'options', values: ['ACTIVE'] })).toEqual(
            { enrollmentStatus: 'ACTIVE' }
        )
        expect(
            status.toQuery({ kind: 'options', values: ['CANCELLED'] })
        ).toEqual({ enrollmentStatus: 'CANCELLED' })
        expect(status.toQuery({ kind: 'options', values: ['PAUSED'] })).toEqual(
            {}
        )
    })

    it('maps enrollment and incident date ranges', () => {
        expect(
            enrolled.toQuery({
                kind: 'date',
                from: '2024-01-01',
                to: '2024-01-31',
            })
        ).toEqual({ enrolledAfter: '2024-01-01', enrolledBefore: '2024-01-31' })
        expect(enrolled.toQuery({ kind: 'date', to: '2024-01-31' })).toEqual({
            enrolledBefore: '2024-01-31',
        })
        expect(
            occurred.toQuery({
                kind: 'date',
                from: '2023-12-01',
                to: '2023-12-31',
            })
        ).toEqual({ occurredAfter: '2023-12-01', occurredBefore: '2023-12-31' })
    })

    it('returns nothing for a value of another kind', () => {
        const others: DataTableFilterValue[] = [
            textValue('contains', 'x'),
            { kind: 'number', min: 1 },
            { kind: 'date', from: '2024-01-01' },
            { kind: 'options', values: ['x'] },
            { kind: 'boolean', value: true },
            { kind: 'custom', value: 'x' },
        ]
        const filters = [text, number, date, options, boolean, status, enrolled]
        for (const filter of filters) {
            for (const value of others) {
                if (value.kind === filter.kind) continue
                expect(filter.toQuery(value)).toEqual({})
            }
        }
    })
})

describe('toPatientListFilterQuery', () => {
    const name = attributeTextFilter({
        attribute: 'aName000001',
        label: 'Name',
    })
    const district = attributeOptionsFilter({
        attribute: 'aDistrict01',
        label: 'District',
        options: [{ value: 'Bo', label: 'Bo' }],
    })

    it('is empty with no base and no entries', () => {
        expect(toPatientListFilterQuery([name], [])).toEqual({})
    })

    it('returns the base query alone', () => {
        const base = {
            filters: ['aBase000001:eq:x'],
            enrollmentStatus: 'ACTIVE',
        } as const
        expect(toPatientListFilterQuery([name], [], base)).toEqual(base)
    })

    it('concatenates filters, base first, then in filters order', () => {
        expect(
            toPatientListFilterQuery(
                [name, district],
                [
                    {
                        id: 'aDistrict01',
                        value: { kind: 'options', values: ['Bo'] },
                    },
                    {
                        id: 'aName000001',
                        value: textValue('contains', 'ami'),
                    },
                ],
                { filters: ['aBase000001:eq:x'] }
            )
        ).toEqual({
            filters: [
                'aBase000001:eq:x',
                'aName000001:like:ami',
                'aDistrict01:eq:Bo',
            ],
        })
    })

    it('lets the later scalar win and merges params', () => {
        expect(
            toPatientListFilterQuery(
                [status, enrolled],
                [
                    {
                        id: 'enrollmentStatus',
                        value: { kind: 'options', values: ['COMPLETED'] },
                    },
                    {
                        id: 'enrolledAt',
                        value: { kind: 'date', to: '2024-06-30' },
                    },
                ],
                {
                    enrollmentStatus: 'ACTIVE',
                    enrolledAfter: '2024-01-01',
                    enrolledBefore: '2024-12-31',
                    params: { followUp: 'true' },
                }
            )
        ).toEqual({
            enrollmentStatus: 'COMPLETED',
            enrolledAfter: '2024-01-01',
            enrolledBefore: '2024-06-30',
            params: { followUp: 'true' },
        })

        const withParams = {
            ...name,
            toQuery: () => ({ params: { assignedUserMode: 'CURRENT' } }),
        }
        expect(
            toPatientListFilterQuery(
                [withParams],
                [{ id: 'aName000001', value: textValue('contains', 'x') }],
                { params: { followUp: 'true', assignedUserMode: 'ANY' } }
            )
        ).toEqual({
            params: { followUp: 'true', assignedUserMode: 'CURRENT' },
        })
    })

    it('ignores unknown ids, unreadable values and empty values', () => {
        expect(
            toPatientListFilterQuery(
                [name, district],
                [
                    { id: 'unknown', value: textValue('contains', 'x') },
                    { id: 'aName000001', value: 'not a filter value' },
                    {
                        id: 'aDistrict01',
                        value: { kind: 'options', values: [] },
                    },
                ]
            )
        ).toEqual({})
        expect(
            toPatientListFilterQuery(
                [name],
                [{ id: 'aName000001', value: textValue('contains', '  ') }]
            )
        ).toEqual({})
    })

    it('does not change the base query', () => {
        const base = { filters: ['aBase000001:eq:x'] }
        toPatientListFilterQuery(
            [name],
            [{ id: 'aName000001', value: textValue('contains', 'x') }],
            base
        )
        expect(base).toEqual({ filters: ['aBase000001:eq:x'] })
    })
})
