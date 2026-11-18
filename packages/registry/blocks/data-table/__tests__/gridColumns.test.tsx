import type { ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    createDataTableColumnHelper,
    DataTable,
    DataTableContent,
    DataTableFilters,
    dataTableExpanderColumn,
    dataTableSelectionColumn,
    useDataTable,
    useDataTableInstance,
    type DataTableColumnDef,
    type DataTableLayout,
} from '..'
import {
    StateProbe,
    makePeople,
    personColumns,
    type Person,
} from './dataTableTestSupport'

const people = makePeople(12)
const column = createDataTableColumnHelper<Person>()

const SizingProbe = () => {
    const table = useDataTableInstance()
    return (
        <output data-testid="sizing">
            {JSON.stringify(table.state.columnSizing)}
        </output>
    )
}

const Harness = ({
    layout = 'fixed',
    columns = personColumns,
    children,
}: {
    layout?: DataTableLayout
    columns?: DataTableColumnDef<Person>[]
    children?: ReactNode
}) => {
    const table = useDataTable({
        data: people,
        columns,
        getRowId: (person) => person.id,
    })
    return (
        <DataTable table={table} label="People" layout={layout}>
            <StateProbe />
            <SizingProbe />
            {children}
            <DataTableContent columnMenu />
        </DataTable>
    )
}

const state = () =>
    JSON.parse(page.getByTestId('state').element().textContent ?? '{}')

const sizing = () =>
    JSON.parse(page.getByTestId('sizing').element().textContent ?? '{}')

const chooseFromMenu = async (columnName: string, item: string) => {
    await userEvent.click(
        page.getByRole('button', { name: `Options for ${columnName}` })
    )
    await userEvent.click(page.getByRole('menuitem', { name: item }))
}

const menuItems = async (columnName: string) => {
    await userEvent.click(
        page.getByRole('button', { name: `Options for ${columnName}` })
    )
    await expect.element(page.getByRole('menu')).toBeVisible()
    const items = page
        .getByRole('menuitem')
        .all()
        .map((item) => item.element().textContent)
    await userEvent.keyboard('{Escape}')
    return items
}

const firstCell = (columnId: string) => {
    const cell = document.querySelector<HTMLElement>(
        `td[data-column-id="${columnId}"]`
    )
    if (cell === null) throw new Error(`No ${columnId} cell`)
    return cell
}

const headerNames = () =>
    page
        .getByRole('columnheader')
        .all()
        .map((header) => header.element().textContent)

describe('DataTableContent columns (layout fixed)', () => {
    it('sorts from the column menu', async () => {
        await render(<Harness />)
        await chooseFromMenu('Name', 'Sort descending')
        expect(state().sorting).toEqual([{ id: 'name', desc: true }])
        await expect
            .element(page.getByRole('columnheader', { name: 'Name' }))
            .toHaveAttribute('aria-sort', 'descending')

        await chooseFromMenu('Name', 'Sort ascending')
        expect(state().sorting).toEqual([{ id: 'name', desc: false }])

        await chooseFromMenu('Name', 'Clear sorting')
        expect(state().sorting).toEqual([])
    })

    it('offers "Clear sorting" only on a sorted column', async () => {
        await render(<Harness />)
        expect(await menuItems('Age')).toEqual([
            'Sort ascending',
            'Sort descending',
            'Pin to start',
            'Pin to end',
            'Hide column',
        ])
    })

    it('pins columns from the column menu, with sticky offsets', async () => {
        await render(<Harness />)
        await chooseFromMenu('Name', 'Pin to start')
        await chooseFromMenu('District', 'Pin to start')
        expect(state().columnPinning).toEqual({
            start: ['name', 'district'],
            end: [],
        })
        expect(headerNames().slice(0, 2)).toEqual(['Name', 'District'])

        const district = firstCell('district')
        expect(getComputedStyle(district).position).toBe('sticky')
        expect(district.style.insetInlineStart).toBe('180px')
        expect(getComputedStyle(firstCell('name')).insetInlineStart).toBe('0px')
        expect(district.classList.contains('border-e')).toBe(true)

        await chooseFromMenu('District', 'Unpin')
        expect(state().columnPinning.start).toEqual(['name'])
        expect(getComputedStyle(firstCell('district')).position).not.toBe(
            'sticky'
        )

        await chooseFromMenu('Active', 'Pin to end')
        expect(state().columnPinning.end).toEqual(['active'])
        const active = firstCell('active')
        expect(getComputedStyle(active).position).toBe('sticky')
        expect(active.style.insetInlineEnd).toBe('0px')
        expect(active.classList.contains('border-s')).toBe(true)
        expect(headerNames().at(-1)).toBe('Active')
    })

    it('hides a column from the column menu', async () => {
        await render(<Harness />)
        await chooseFromMenu('District', 'Hide column')
        expect(state().columnVisibility).toEqual({ district: false })
        await expect
            .element(page.getByRole('columnheader', { name: 'District' }))
            .not.toBeInTheDocument()
    })

    it('hands focus to the next column menu, else the previous one', async () => {
        await render(<Harness />)
        await chooseFromMenu('District', 'Hide column')
        await expect
            .element(
                page.getByRole('button', { name: 'Options for Registered' })
            )
            .toHaveFocus()

        await chooseFromMenu('Active', 'Hide column')
        await expect
            .element(
                page.getByRole('button', { name: 'Options for Registered' })
            )
            .toHaveFocus()
    })

    it('hands focus to the filters when no other header has a menu', async () => {
        const columns = column.columns([
            column.accessor('name', {
                header: 'Name',
                enableSorting: false,
                enableHiding: false,
            }),
            column.accessor('age', { header: 'Age' }),
        ])
        await render(
            <Harness layout="auto" columns={columns}>
                <DataTableFilters
                    filters={[{ id: 'name', label: 'Name', kind: 'text' }]}
                />
            </Harness>
        )
        await chooseFromMenu('Age', 'Hide column')
        await expect
            .element(page.getByRole('button', { name: 'Filter' }))
            .toHaveFocus()
    })

    it('does not offer to hide the last visible column', async () => {
        await render(<Harness columns={personColumns.slice(0, 1)} />)
        expect(await menuItems('Name')).not.toContain('Hide column')
    })

    it('offers grouping only where the column definition enables it', async () => {
        const columns = column.columns([
            column.accessor('name', { header: 'Name' }),
            column.accessor('district', {
                header: 'District',
                enableGrouping: true,
            }),
        ])
        await render(<Harness columns={columns} />)
        expect(await menuItems('Name')).not.toContain('Group by this column')
        await chooseFromMenu('District', 'Group by this column')
        expect(
            page.getByRole('button', { name: 'Bo (3)' }).element()
        ).toBeTruthy()
        expect(await menuItems('District')).toContain('Stop grouping')
    })

    it('centres a 24px resize handle on the border, inside the last column', async () => {
        await render(<Harness />)
        const box = (selector: string) => {
            const element = document.querySelector(selector)
            if (element === null) throw new Error(`No ${selector}`)
            return { element, rect: element.getBoundingClientRect() }
        }
        const name = box('[aria-label="Resize Name"]')
        const nameHead = box('th[data-column-id="name"]')
        expect(name.rect.width).toBe(24)
        expect(nameHead.rect.height - name.rect.height).toBeLessThanOrEqual(1)
        expect(
            Math.abs(name.rect.left + 12 - nameHead.rect.right)
        ).toBeLessThan(1)
        expect(getComputedStyle(name.element, '::after').width).toBe('2px')
        expect(getComputedStyle(name.element, '::after').right).toBe('11px')

        const active = box('[aria-label="Resize Active"]')
        const activeHead = box('th[data-column-id="active"]')
        expect(active.rect.width).toBe(24)
        expect(activeHead.rect.right - active.rect.right).toBeLessThanOrEqual(1)
        expect(
            activeHead.rect.right - active.rect.right
        ).toBeGreaterThanOrEqual(0)
        expect(getComputedStyle(active.element, '::after').right).toBe('0px')
        // Room for the handle: it does not cover the column menu.
        const menu = box(
            'th[data-column-id="active"] [data-slot="data-table-column-menu"]'
        )
        expect(menu.rect.right).toBeLessThanOrEqual(active.rect.left)
    })

    it('resizes a column with the keyboard', async () => {
        await render(<Harness />)
        page.getByRole('button', { name: 'Resize Name' }).element().focus()
        await userEvent.keyboard('{ArrowRight}')
        expect(sizing()).toEqual({ name: 196 })
        await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
        expect(sizing()).toEqual({ name: 164 })
        const col = document.querySelector('colgroup col')
        expect(col?.getAttribute('style')).toContain('width: 164px')
        await userEvent.keyboard('{Home}')
        expect(sizing()).toEqual({})
    })

    it('keeps a keyboard resize within the column’s minimum size', async () => {
        const columns = column.columns([
            column.accessor('name', { header: 'Name', size: 70, minSize: 64 }),
        ])
        await render(<Harness columns={columns} />)
        page.getByRole('button', { name: 'Resize Name' }).element().focus()
        await userEvent.keyboard('{ArrowLeft}')
        expect(sizing()).toEqual({ name: 64 })
    })

    it('mirrors the arrow keys in a right-to-left page', async () => {
        await render(
            <div dir="rtl">
                <Harness />
            </div>
        )
        page.getByRole('button', { name: 'Resize Name' }).element().focus()
        await userEvent.keyboard('{ArrowLeft}')
        expect(sizing()).toEqual({ name: 196 })
    })

    it('sizes the table from the columns', async () => {
        await render(<Harness />)
        const table = page.getByRole('table', { name: 'People' }).element()
        expect(getComputedStyle(table).tableLayout).toBe('fixed')
        expect(table.style.width).toBe(`${5 * 180}px`)
        expect(document.querySelectorAll('colgroup col')).toHaveLength(5)
    })
})

describe('DataTableContent columns (layout auto)', () => {
    it('has no resize handles, no pin items and no column widths', async () => {
        await render(<Harness layout="auto" />)
        await expect
            .element(page.getByRole('cell', { name: 'Amina 1' }))
            .toBeVisible()
        expect(
            document.querySelectorAll('[data-slot="data-table-resize"]')
        ).toHaveLength(0)
        expect(document.querySelector('colgroup')).toBeNull()
        expect(await menuItems('Name')).toEqual([
            'Sort ascending',
            'Sort descending',
            'Hide column',
        ])
    })

    it('gives the utility columns only their content width', async () => {
        const columns = [
            dataTableSelectionColumn<Person>(),
            dataTableExpanderColumn<Person>(),
            ...personColumns,
            column.display({
                id: 'actions',
                enableHiding: false,
                meta: { label: 'Actions' },
                cell: () => <button type="button">Act</button>,
            }),
        ]
        await render(<Harness layout="auto" columns={columns} />)
        await expect
            .element(page.getByRole('cell', { name: 'Amina 1' }))
            .toBeVisible()
        for (const id of ['select', 'expand', 'actions']) {
            const head = document.querySelector(`th[data-column-id="${id}"]`)
            expect(head?.classList.contains('w-px')).toBe(true)
        }
        expect(
            document
                .querySelector('th[data-column-id="name"]')
                ?.classList.contains('w-px')
        ).toBe(false)
        const select = document.querySelector('th[data-column-id="select"]')
        expect(select?.getBoundingClientRect().width).toBeLessThan(60)
    })
})
