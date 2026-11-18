import type { DataTableColumnDef } from '@/components/data-table'
import type { PatientListRow } from '@/components/patient-list'
import {
    buildInitialColumnVisibility,
    buildPatientListColumns,
    buildPatientListFilters,
} from './patientListModel'
import type { ProgramListAttribute } from './programListMetadata'

const attributes: ProgramListAttribute[] = [
    {
        id: 'firstName01',
        label: 'First name',
        valueType: 'TEXT',
        displayInList: true,
        searchable: true,
    },
    {
        id: 'gender00001',
        label: 'Gender',
        valueType: 'TEXT',
        displayInList: true,
        searchable: false,
        options: [
            { code: 'F', displayName: 'Female' },
            { code: 'M', displayName: 'Male' },
        ],
    },
    {
        id: 'birthDate01',
        label: 'Date of birth',
        valueType: 'DATE',
        displayInList: true,
        searchable: true,
    },
    {
        id: 'weight00001',
        label: 'Weight',
        valueType: 'NUMBER',
        displayInList: false,
        searchable: true,
    },
    {
        id: 'consent0001',
        label: 'Consent',
        valueType: 'BOOLEAN',
        displayInList: true,
        searchable: true,
    },
    {
        id: 'location001',
        label: 'Home location',
        valueType: 'COORDINATE',
        displayInList: false,
        searchable: false,
    },
]

const row: PatientListRow = {
    trackedEntity: 'te01',
    inactive: false,
    attributes: { gender00001: 'F', birthDate01: '2024-06-30' },
    enrollment: {
        enrollment: 'en01',
        status: 'COMPLETED',
        enrolledAt: '2024-06-30T23:30:00.000',
    },
}

type Column = DataTableColumnDef<PatientListRow>

const columnById = (columns: readonly Column[], id: string) => {
    const column = columns.find((candidate) => candidate.id === id)
    if (!column) throw new Error(`No column ${id}`)
    return column
}

const renderCell = (column: Column, value: string | undefined) => {
    const { cell } = column
    if (!(cell instanceof Function)) {
        throw new Error(`Column ${column.id} has no cell renderer`)
    }
    // SAFETY: the patient list's value cells read only getValue and
    // row.original, which are the two members given here.
    const context = {
        getValue: () => value,
        row: { original: row },
    } as Parameters<typeof cell>[0]
    return cell(context)
}

describe('buildPatientListColumns', () => {
    const columns = buildPatientListColumns(attributes)

    it('lists every attribute in order, then enrollment date and status', () => {
        expect(columns.map((column) => column.id)).toEqual([
            'firstName01',
            'gender00001',
            'birthDate01',
            'weight00001',
            'consent0001',
            'location001',
            'enrolledAt',
            'enrollmentStatus',
        ])
        expect(columns.map((column) => column.header)).toEqual([
            'First name',
            'Gender',
            'Date of birth',
            'Weight',
            'Consent',
            'Home location',
            'Enrollment date',
            'Status',
        ])
    })

    it('aligns numbers to the end and keeps the enrollment date on one line', () => {
        expect(columnById(columns, 'weight00001').meta?.align).toBe('end')
        expect(columnById(columns, 'firstName01').meta?.align).toBeUndefined()
        expect(columnById(columns, 'enrolledAt').meta?.nowrap).toBe(true)
    })

    it('shows option names, readable dates and status labels', () => {
        expect(renderCell(columnById(columns, 'gender00001'), 'F')).toBe(
            'Female'
        )

        const date = renderCell(
            columnById(columns, 'birthDate01'),
            '2024-06-30'
        )
        expect(date).not.toBe('2024-06-30')
        expect(String(date)).toMatch(/30/)
        expect(String(date)).toMatch(/2024/)

        const enrolled = renderCell(
            columnById(columns, 'enrolledAt'),
            '2024-06-30T23:30:00.000'
        )
        expect(enrolled).toBe(date)

        expect(
            renderCell(columnById(columns, 'enrollmentStatus'), 'COMPLETED')
        ).toBe('Completed')
        expect(renderCell(columnById(columns, 'birthDate01'), undefined)).toBe(
            ''
        )
    })
})

describe('buildInitialColumnVisibility', () => {
    it('hides only the attributes the program keeps out of its list', () => {
        expect(buildInitialColumnVisibility(attributes)).toEqual({
            weight00001: false,
            location001: false,
        })
    })
})

describe('buildPatientListFilters', () => {
    const filters = buildPatientListFilters(attributes)

    it('offers a filter per value type that can be filtered', () => {
        expect(filters.map(({ id, kind }) => [id, kind])).toEqual([
            ['enrollmentStatus', 'options'],
            ['firstName01', 'text'],
            ['gender00001', 'options'],
            ['birthDate01', 'date'],
            ['weight00001', 'number'],
            ['consent0001', 'boolean'],
            ['enrolledAt', 'date'],
        ])
    })

    it('lets text be matched in three ways and options be combined', () => {
        const text = filters.find(({ id }) => id === 'firstName01')
        expect(text?.kind === 'text' && text.operators).toEqual([
            'contains',
            'equals',
            'startsWith',
        ])
        const gender = filters.find(({ id }) => id === 'gender00001')
        expect(gender?.kind === 'options' && gender).toMatchObject({
            multiple: true,
            options: [
                { value: 'F', label: 'Female' },
                { value: 'M', label: 'Male' },
            ],
        })
        expect(filters.at(-1)?.label).toBe('Enrollment date')
    })

    it('pins the status and the first two listed, searchable attributes', () => {
        expect(
            filters.filter(({ pinned }) => pinned).map(({ id }) => id)
        ).toEqual(['enrollmentStatus', 'firstName01', 'birthDate01'])
    })
})
