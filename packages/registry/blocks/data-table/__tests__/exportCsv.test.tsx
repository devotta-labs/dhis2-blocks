import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    DataTableExportButton,
    createDataTableColumnHelper,
    dataTableSelectionColumn,
    dataTableToCsv,
    downloadDataTableCsv,
    type DataTableColumnDef,
    type DataTableInstance,
    type DataTableState,
} from '..'
import { makePeople, personColumns, type Person } from './dataTableTestSupport'
import { ToolsHarness } from './toolsTestSupport'

let latest: DataTableInstance<Person> | undefined
const current = () => {
    if (!latest) throw new Error('The harness has not rendered.')
    return latest
}

const renderTable = ({
    data = makePeople(12),
    columns = personColumns,
    initialState,
}: {
    data?: Person[]
    columns?: DataTableColumnDef<Person>[]
    initialState?: Partial<DataTableState>
}) =>
    render(
        <ToolsHarness
            data={data}
            columns={columns}
            options={{ initialState }}
            onTable={(table) => {
                latest = table
            }}
        />
    )

const column = createDataTableColumnHelper<Person>()
const nameAndAge = [
    column.accessor('name', { header: 'Name' }),
    column.accessor('age', { header: 'Age' }),
]

const person = (id: string, name: string): Person => ({
    id,
    name,
    age: 30,
    district: 'Bo',
    registered: '2024-01-01',
    active: true,
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('dataTableToCsv', () => {
    it('quotes per RFC 4180 with CRLF and guards formulas', async () => {
        await renderTable({
            columns: nameAndAge,
            data: [
                person('a', 'Doe, Jane'),
                person('b', 'Say "hi"'),
                person('c', 'Line\nbreak'),
                person('d', '=SUM(A1:A2)'),
                person('e', '+1'),
                person('f', '-2'),
                person('g', '@cmd'),
                person('h', '\tTab'),
                person('i', '\rReturn'),
                person('j', 'Plain'),
            ],
            initialState: { pagination: { pageIndex: 0, pageSize: 50 } },
        })

        expect(dataTableToCsv(current())).toBe(
            [
                'Name,Age',
                '"Doe, Jane",30',
                '"Say ""hi""",30',
                '"Line\nbreak",30',
                "'=SUM(A1:A2),30",
                '+1,30',
                '-2,30',
                "'@cmd,30",
                "'\tTab,30",
                `"'\rReturn",30`,
                'Plain,30',
            ].join('\r\n')
        )
    })

    it('leaves plain numbers alone and guards other formula starts', async () => {
        const plain = ['-5', '-5.25', '+3', '1e-5']
        const guarded = ['-5+cmd', '=1+1', '-A1', '+A1', '@x']
        await renderTable({
            columns: [column.accessor('name', { header: 'Name' })],
            data: [...plain, ...guarded].map((text, index) =>
                person(String(index), text)
            ),
        })

        expect(dataTableToCsv(current()).split('\r\n').slice(1)).toEqual([
            ...plain,
            ...guarded.map((text) => `'${text}`),
        ])
    })

    it('skips hidden and utility columns and follows the display order', async () => {
        await renderTable({
            data: makePeople(1),
            columns: [
                dataTableSelectionColumn<Person>(),
                ...personColumns,
                column.display({ id: 'actions', header: 'Actions' }),
            ],
            initialState: {
                columnVisibility: { registered: false },
                columnPinning: { start: ['district'], end: [] },
                columnOrder: ['select', 'age', 'name'],
            },
        })

        expect(dataTableToCsv(current())).toBe(
            'District,Age,Name,Active\r\nBo,18,Amina 1,false'
        )
    })

    it('exports all rows, the page or the selected rows', async () => {
        await renderTable({
            columns: [column.accessor('name', { header: 'Name' })],
            initialState: {
                sorting: [{ id: 'name', desc: true }],
                pagination: { pageIndex: 0, pageSize: 3 },
                rowSelection: { 'person-2': true, 'person-11': true },
            },
        })
        const lines = (rows: 'all' | 'page' | 'selected') =>
            dataTableToCsv(current(), { rows }).split('\r\n')

        expect(lines('all')).toHaveLength(13)
        expect(lines('all').slice(0, 3)).toEqual([
            'Name',
            'Kofi 11',
            'Jamila 10',
        ])
        expect(lines('page')).toEqual([
            'Name',
            'Kofi 11',
            'Jamila 10',
            'Ibrahim 9',
        ])
        expect(lines('selected')).toEqual(['Name', 'Kofi 11', 'Bakary 2'])
    })

    it('formats with formatValue, joins arrays and takes a delimiter', async () => {
        await renderTable({
            data: [person('a', 'Ami; Bo')],
            columns: [
                ...nameAndAge,
                column.accessor((row) => [row.district, row.registered], {
                    id: 'tags',
                    header: 'Tags',
                }),
            ],
        })

        expect(dataTableToCsv(current())).toBe(
            'Name,Age,Tags\r\nAmi; Bo,30,Bo; 2024-01-01'
        )
        expect(dataTableToCsv(current(), { delimiter: ';' })).toBe(
            'Name;Age;Tags\r\n"Ami; Bo";30;"Bo; 2024-01-01"'
        )
        expect(
            dataTableToCsv(current(), {
                formatValue: (cell) =>
                    cell.column.id === 'age'
                        ? `${String(cell.getValue())} years`
                        : 'x',
            })
        ).toBe('Name,Age,Tags\r\nx,30 years,x')
    })

    it('exports the leaf rows of grouped rows', async () => {
        await renderTable({
            data: makePeople(6),
            columns: nameAndAge.concat(
                column.accessor('district', { header: 'District' })
            ),
            initialState: { grouping: ['district'] },
        })

        const lines = dataTableToCsv(current()).split('\r\n')
        // Grouping puts the grouped column first.
        expect(lines[0]).toBe('District,Name,Age')
        expect(lines).toHaveLength(7)
        expect(lines).toContain('Bo,Amina 1,18')
        expect(lines).toContain('Bo,Fatou 6,53')
    })
})

describe('downloadDataTableCsv', () => {
    it('downloads a UTF-8 CSV with a BOM and revokes the URL', async () => {
        await renderTable({ data: makePeople(1), columns: nameAndAge })
        const blobs: Blob[] = []
        const create = vi
            .spyOn(URL, 'createObjectURL')
            .mockImplementation((blob) => {
                if (blob instanceof Blob) blobs.push(blob)
                return 'blob:data-table-test'
            })
        const revoke = vi
            .spyOn(URL, 'revokeObjectURL')
            .mockImplementation(() => undefined)
        const links: HTMLAnchorElement[] = []
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
            function (this: HTMLAnchorElement) {
                links.push(this)
            }
        )

        downloadDataTableCsv(current(), 'people')

        expect(create).toHaveBeenCalledTimes(1)
        expect(links).toHaveLength(1)
        expect(links[0].download).toBe('people.csv')
        expect(links[0].href).toBe('blob:data-table-test')
        expect(links[0].isConnected).toBe(false)
        expect(blobs[0].type).toBe('text/csv;charset=utf-8')
        const bytes = new Uint8Array(await blobs[0].arrayBuffer())
        expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
        expect(await blobs[0].text()).toBe('Name,Age\r\nAmina 1,18')
        await expect
            .poll(() => revoke.mock.calls)
            .toEqual([['blob:data-table-test']])

        downloadDataTableCsv(current(), 'people.CSV')
        expect(links[1].download).toBe('people.CSV')
    })
})

describe('DataTableExportButton', () => {
    it('downloads the context table', async () => {
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:button')
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
        const files: string[] = []
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
            function (this: HTMLAnchorElement) {
                files.push(this.download)
            }
        )
        await render(
            <ToolsHarness>
                <DataTableExportButton filename="people" rows="page" />
                <DataTableExportButton filename="all">
                    Export all
                </DataTableExportButton>
            </ToolsHarness>
        )

        const button = page.getByRole('button', { name: 'Download CSV' })
        await expect
            .element(button)
            .toHaveAttribute('data-slot', 'data-table-export')
        await button.click()
        await page.getByRole('button', { name: 'Export all' }).click()

        expect(files).toEqual(['people.csv', 'all.csv'])
    })

    it('passes formatValue and delimiter to the download', async () => {
        const blobs: Blob[] = []
        vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
            if (blob instanceof Blob) blobs.push(blob)
            return 'blob:button'
        })
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
            () => undefined
        )
        await render(
            <ToolsHarness data={makePeople(1)} columns={nameAndAge}>
                <DataTableExportButton
                    filename="people"
                    delimiter=";"
                    formatValue={(cell) =>
                        cell.column.id === 'age'
                            ? `${String(cell.getValue())} years`
                            : 'x'
                    }
                />
            </ToolsHarness>
        )

        await page.getByRole('button', { name: 'Download CSV' }).click()

        expect(blobs).toHaveLength(1)
        expect(await blobs[0].text()).toBe('Name;Age\r\nx;18 years')
    })
})
