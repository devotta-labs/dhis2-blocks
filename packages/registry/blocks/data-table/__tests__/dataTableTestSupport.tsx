import { createDataTableColumnHelper, useDataTableInstance } from '..'

export interface Person {
    id: string
    name: string
    age: number
    district: string
    /** `yyyy-mm-dd` */
    registered: string
    active: boolean
}

const firstNames = [
    'Amina',
    'Bakary',
    'Chidi',
    'Dalia',
    'Esi',
    'Fatou',
    'Gabriel',
    'Hawa',
    'Ibrahim',
    'Jamila',
    'Kofi',
]
const districts = ['Bo', 'Bombali', 'Kailahun', 'Kenema', 'Port Loko']

const pad = (value: number) => String(value).padStart(2, '0')

/** The same people for the same count: person `n` is always the same row. */
export const makePeople = (count: number): Person[] =>
    Array.from({ length: count }, (_, index) => ({
        id: `person-${index + 1}`,
        name: `${firstNames[index % firstNames.length]} ${index + 1}`,
        age: 18 + ((index * 7) % 61),
        district: districts[index % districts.length],
        registered: `2024-${pad((index % 12) + 1)}-${pad((index % 28) + 1)}`,
        active: index % 3 !== 0,
    }))

const column = createDataTableColumnHelper<Person>()

export const personColumns = column.columns([
    column.accessor('name', { header: 'Name' }),
    column.accessor('age', { header: 'Age', meta: { align: 'end' } }),
    column.accessor('district', { header: 'District' }),
    column.accessor('registered', { header: 'Registered' }),
    column.accessor('active', { header: 'Active' }),
])

/** The table state the parts change, as JSON, for assertions. */
export const StateProbe = () => {
    const table = useDataTableInstance()
    const {
        sorting,
        columnFilters,
        globalFilter,
        pagination,
        rowSelection,
        columnVisibility,
        columnOrder,
        columnPinning,
    } = table.state
    return (
        <output data-testid="state">
            {JSON.stringify({
                sorting,
                columnFilters,
                globalFilter,
                pagination,
                rowSelection,
                columnVisibility,
                columnOrder,
                columnPinning,
            })}
        </output>
    )
}
