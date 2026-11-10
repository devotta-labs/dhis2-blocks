import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Alert } from './alert'
import { ChartContainer } from './chart'
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxInput,
    ComboboxValue,
} from './combobox'
import { Dialog, DialogContent, DialogTitle } from './dialog'
import { InputGroup, InputGroupInput } from './input-group'
import { Spinner } from './spinner'

const Chips = () => (
    <Combobox items={['Ngelehun', 'Bo']} multiple defaultValue={['Ngelehun']}>
        <ComboboxChips>
            <ComboboxValue>
                {(chosen: string[]) =>
                    chosen.map((name) => (
                        <ComboboxChip key={name} removeLabel={`Remove ${name}`}>
                            {name}
                        </ComboboxChip>
                    ))
                }
            </ComboboxValue>
            <ComboboxChipsInput aria-label="Facilities" />
        </ComboboxChips>
    </Combobox>
)

const size = (element: Element) => element.getBoundingClientRect()

test('combobox chip shows focus', async () => {
    await render(<Chips />)
    page.getByRole('combobox', { name: 'Facilities' }).element().focus()
    await userEvent.keyboard('{ArrowLeft}')
    const chip = document.querySelector('[data-slot="combobox-chip"]')
    if (chip === null) {
        throw new Error('No chip')
    }
    expect(document.activeElement).toBe(chip)
    expect(getComputedStyle(chip).outlineStyle).not.toBe('none')
})

test('Tab leaves a combobox input for the next field, past its open button', async () => {
    await render(
        <>
            <Combobox items={['Bo', 'Kenema']}>
                <ComboboxInput aria-label="District" />
            </Combobox>
            <input aria-label="Next" />
        </>
    )
    await userEvent.click(page.getByRole('combobox', { name: 'District' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.tab()
    await expect
        .element(page.getByRole('textbox', { name: 'Next' }))
        .toHaveFocus()
})

test('chip remove and dialog close are at least 24 by 24', async () => {
    await render(
        <>
            <Chips />
            <Dialog open>
                <DialogContent closeLabel="Close">
                    <DialogTitle>Edit</DialogTitle>
                </DialogContent>
            </Dialog>
        </>
    )
    // The open dialog hides the chip from the accessibility tree, so it is found by its slot.
    for (const target of [
        document.querySelector('[data-slot="combobox-chip-remove"]'),
        page.getByRole('button', { name: 'Close' }).element(),
    ]) {
        if (target === null) {
            throw new Error('No target')
        }
        const box = size(target)
        expect(box.width).toBeGreaterThanOrEqual(24)
        expect(box.height).toBeGreaterThanOrEqual(24)
    }
})

test('dialog card scrolls', async () => {
    await render(
        <Dialog open>
            <DialogContent closeLabel="Close">
                <DialogTitle>Edit</DialogTitle>
            </DialogContent>
        </Dialog>
    )
    const card = page.getByRole('dialog').element()
    expect(getComputedStyle(card).overflowY).toBe('auto')
})

test('alert role follows the variant', async () => {
    await render(
        <>
            <Alert variant="destructive">Save failed</Alert>
            <Alert>Saved</Alert>
        </>
    )
    await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent('Save failed')
    await expect.element(page.getByRole('status')).toHaveTextContent('Saved')
})

test('spinner is named by its label', async () => {
    await render(<Spinner label="Loading results" />)
    await expect
        .element(page.getByRole('status', { name: 'Loading results' }))
        .toBeInTheDocument()
})

test('spinner without a label is hidden from screen readers', async () => {
    await render(<Spinner data-testid="spinner" />)
    const spinner = page.getByTestId('spinner').element()
    expect(spinner).toHaveAttribute('aria-hidden', 'true')
    expect(spinner).not.toHaveAttribute('role')
})

test('input group has no unnamed group role', async () => {
    await render(
        <InputGroup data-testid="group">
            <InputGroupInput aria-label="Search" />
        </InputGroup>
    )
    expect(page.getByTestId('group').element()).not.toHaveAttribute('role')
})

test('chart reads its summary', async () => {
    await render(
        <ChartContainer
            config={{}}
            summary="Weight rose from 3 to 5 kg"
            data-testid="chart"
        >
            <div />
        </ChartContainer>
    )
    await expect
        .element(page.getByText('Weight rose from 3 to 5 kg'))
        .toBeInTheDocument()
    expect(page.getByTestId('chart').element().className).not.toContain(
        'outline-hidden'
    )
})
