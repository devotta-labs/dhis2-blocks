import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    DataTableFilters,
    summarizeDataTableFilter,
    type DataTableCustomFilterControlProps,
    type DataTableFilter,
} from '..'
import { ToolsHarness, toolsState } from './toolsTestSupport'

// Server mode: the filters only write state, so ids need not be columns.
const renderFilters = (filters: readonly DataTableFilter[]) =>
    render(
        <ToolsHarness options={{ mode: 'server' }}>
            <DataTableFilters filters={filters} />
        </ToolsHarness>
    )

const chip = (name: string) => page.getByRole('combobox', { name, exact: true })

const apply = () => page.getByRole('button', { name: 'Apply' }).click()

const filtersInState = () => toolsState().columnFilters

const RiskControl = ({
    value,
    onChange,
}: DataTableCustomFilterControlProps) => (
    <div>
        <p>Current: {value ?? 'none'}</p>
        <button type="button" onClick={() => onChange('high')}>
            High risk
        </button>
        <button type="button" onClick={() => onChange(undefined)}>
            Any risk
        </button>
    </div>
)

const riskFilter: DataTableFilter = {
    id: 'risk',
    kind: 'custom',
    label: 'Risk',
    pinned: true,
    Control: RiskControl,
    summarize: (value) => (value === 'high' ? 'High' : value),
}

const tenDistricts = [
    'Bo',
    'Bombali',
    'Bonthe',
    'Falaba',
    'Kailahun',
    'Kambia',
    'Karene',
    'Kenema',
    'Koinadugu',
    'Kono',
].map((name) => ({ value: name.toLowerCase(), label: name }))

describe('DataTableFilters: controls', () => {
    it('number: writes min and max and refuses min > max', async () => {
        await renderFilters([
            { id: 'age', kind: 'number', label: 'Age', pinned: true, step: 1 },
        ])

        await chip('Age').click()
        await userEvent.fill(page.getByLabelText('Minimum'), '40')
        await userEvent.fill(page.getByLabelText('Maximum'), '20')
        await apply()

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent('Minimum must not be greater than maximum')
        expect(filtersInState()).toEqual([])

        await userEvent.fill(page.getByLabelText('Maximum'), '60')
        await expect.element(page.getByRole('alert')).not.toBeInTheDocument()
        await apply()

        expect(filtersInState()).toEqual([
            { id: 'age', value: { kind: 'number', min: 40, max: 60 } },
        ])
        await expect.element(chip('Age: 40 – 60')).toBeVisible()

        await chip('Age: 40 – 60').click()
        await userEvent.fill(page.getByLabelText('Maximum'), '')
        await apply()
        expect(filtersInState()).toEqual([
            { id: 'age', value: { kind: 'number', min: 40 } },
        ])
        await expect.element(chip('Age: ≥ 40')).toBeVisible()
    })

    it('date: writes from and to and refuses from > to', async () => {
        await renderFilters([
            {
                id: 'registered',
                kind: 'date',
                label: 'Registered',
                pinned: true,
            },
        ])

        await chip('Registered').click()
        await userEvent.fill(page.getByLabelText('From'), '2024-05-01')
        await userEvent.fill(page.getByLabelText('To'), '2024-01-31')
        await apply()

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent('From must not be after to')
        expect(filtersInState()).toEqual([])

        await userEvent.fill(page.getByLabelText('From'), '2024-01-01')
        await apply()

        expect(filtersInState()).toEqual([
            {
                id: 'registered',
                value: { kind: 'date', from: '2024-01-01', to: '2024-01-31' },
            },
        ])
        await expect
            .element(chip('Registered: 2024-01-01 – 2024-01-31'))
            .toBeVisible()
    })

    it('applying an empty draft clears the filter', async () => {
        await renderFilters([
            { id: 'age', kind: 'number', label: 'Age', pinned: true },
        ])

        await chip('Age').click()
        await userEvent.fill(page.getByLabelText('Minimum'), '18')
        await apply()
        expect(filtersInState()).toHaveLength(1)

        await chip('Age: ≥ 18').click()
        await userEvent.fill(page.getByLabelText('Minimum'), '')
        await apply()

        expect(filtersInState()).toEqual([])
        await expect.element(chip('Age')).toBeVisible()
    })

    it('options: one value with radios', async () => {
        await renderFilters([
            {
                id: 'district',
                kind: 'options',
                label: 'District',
                pinned: true,
                options: [
                    { value: 'bo', label: 'Bo' },
                    { value: 'kenema', label: 'Kenema' },
                ],
            },
        ])

        await chip('District').click()
        const group = page.getByRole('radiogroup', { name: 'District' })
        await group.getByRole('radio', { name: 'Kenema' }).click()
        await apply()

        expect(filtersInState()).toEqual([
            { id: 'district', value: { kind: 'options', values: ['kenema'] } },
        ])
        await expect.element(chip('District: Kenema')).toBeVisible()
    })

    it('options: several values, searchable past eight options', async () => {
        await renderFilters([
            {
                id: 'district',
                kind: 'options',
                label: 'District',
                pinned: true,
                multiple: true,
                options: tenDistricts,
            },
        ])

        await chip('District').click()
        const group = page.getByRole('group', { name: 'District' })
        const boxes = () => group.getByRole('checkbox').elements().length
        await expect.poll(boxes).toBe(10)

        await userEvent.fill(page.getByLabelText('Search options'), 'KEN')
        await expect.poll(boxes).toBe(1)
        await group.getByRole('checkbox', { name: 'Kenema' }).click()

        await userEvent.fill(page.getByLabelText('Search options'), 'bo')
        await expect.poll(boxes).toBe(3)
        await group.getByRole('checkbox', { name: 'Bo', exact: true }).click()
        await group.getByRole('checkbox', { name: 'Bonthe' }).click()
        await apply()

        expect(filtersInState()).toEqual([
            {
                id: 'district',
                value: {
                    kind: 'options',
                    values: ['kenema', 'bo', 'bonthe'],
                },
            },
        ])
        await expect.element(chip('District: Kenema +2')).toBeVisible()
    })

    it('boolean: Yes and No, or the filter labels', async () => {
        await renderFilters([
            {
                id: 'active',
                kind: 'boolean',
                label: 'Active',
                pinned: true,
                falseLabel: 'Inactive',
            },
        ])

        await chip('Active').click()
        await expect
            .element(page.getByRole('radio', { name: 'Yes' }))
            .toBeVisible()
        await page.getByRole('radio', { name: 'Inactive' }).click()
        await apply()

        expect(filtersInState()).toEqual([
            { id: 'active', value: { kind: 'boolean', value: false } },
        ])
        await expect.element(chip('Active: Inactive')).toBeVisible()
    })

    it('custom: the control applies, clears and closes by itself', async () => {
        await renderFilters([riskFilter])

        await chip('Risk').click()
        const dialog = page.getByRole('dialog', { name: 'Risk' })
        await expect.element(dialog.getByText('Current: none')).toBeVisible()
        expect(
            document.querySelector('[data-slot="data-table-filter-apply"]')
        ).toBeNull()
        await dialog.getByRole('button', { name: 'High risk' }).click()

        await expect.element(dialog).not.toBeInTheDocument()
        expect(filtersInState()).toEqual([
            { id: 'risk', value: { kind: 'custom', value: 'high' } },
        ])
        await expect.element(chip('Risk: High')).toBeVisible()

        await chip('Risk: High').click()
        await expect.element(page.getByText('Current: high')).toBeVisible()
        await page.getByRole('button', { name: 'Any risk' }).click()

        expect(filtersInState()).toEqual([])
        await expect.element(chip('Risk')).toBeVisible()
    })
})

describe('summarizeDataTableFilter', () => {
    const text: DataTableFilter = { id: 'name', kind: 'text', label: 'Name' }

    it('summarises each kind', () => {
        expect(
            summarizeDataTableFilter(text, {
                kind: 'text',
                operator: 'contains',
                text: 'Ami',
            })
        ).toBe('Ami')
        expect(
            summarizeDataTableFilter(text, {
                kind: 'text',
                operator: 'startsWith',
                text: 'A & B',
            })
        ).toBe('Starts with A & B')
        expect(
            summarizeDataTableFilter(text, {
                kind: 'text',
                operator: 'equals',
                text: 'Ami',
            })
        ).toBe('Is exactly Ami')
        expect(
            summarizeDataTableFilter(text, {
                kind: 'text',
                operator: 'notEmpty',
                text: '',
            })
        ).toBe('Is not empty')
        expect(summarizeDataTableFilter(text, { kind: 'number', max: 9 })).toBe(
            '≤ 9'
        )
        expect(
            summarizeDataTableFilter(text, { kind: 'date', from: '2024-01-01' })
        ).toBe('From 2024-01-01')
        expect(
            summarizeDataTableFilter(text, { kind: 'date', to: '2024-01-01' })
        ).toBe('Until 2024-01-01')
        expect(
            summarizeDataTableFilter(
                {
                    id: 'district',
                    kind: 'options',
                    label: 'District',
                    options: [
                        { value: 'bo', label: 'Bo' },
                        { value: 'kenema', label: 'Kenema' },
                    ],
                },
                { kind: 'options', values: ['bo', 'kenema'] }
            )
        ).toBe('Bo, Kenema')
        expect(
            summarizeDataTableFilter(
                { id: 'active', kind: 'boolean', label: 'Active' },
                { kind: 'boolean', value: true }
            )
        ).toBe('Yes')
        expect(
            summarizeDataTableFilter(riskFilter, {
                kind: 'custom',
                value: 'high',
            })
        ).toBe('High')
    })
})
