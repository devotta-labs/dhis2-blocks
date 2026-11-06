import React, { createRef, useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsTrigger,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    useComboboxAnchor,
} from './combobox'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog'

const triggerRef = createRef<HTMLButtonElement>()
const Example = ({
    disabled = false,
    invalid = false,
    summary = false,
}: {
    disabled?: boolean
    invalid?: boolean
    summary?: boolean
}) => {
    const [selected, setSelected] = useState(['Alpha', 'Beta'])
    const anchor = useComboboxAnchor()
    return (
        <Combobox
            items={['Alpha', 'Beta', 'Gamma']}
            multiple
            value={selected}
            onValueChange={setSelected}
            disabled={disabled}
        >
            <ComboboxChipsTrigger
                ref={triggerRef}
                anchorRef={anchor}
                size="sm"
                className="w-80"
                aria-label="Choices"
                aria-invalid={invalid || undefined}
                title="Choose values"
            >
                {summary ? (
                    <strong>{selected.length} selected</strong>
                ) : (
                    <ComboboxChips className="min-h-6">
                        {selected.map((value) => (
                            <ComboboxChip
                                key={value}
                                removeLabel={`Fjern ${value}`}
                            >
                                {value}
                            </ComboboxChip>
                        ))}
                    </ComboboxChips>
                )}
            </ComboboxChipsTrigger>
            <ComboboxContent anchor={anchor}>
                <ComboboxInput
                    aria-label="Filter choices"
                    showTrigger={false}
                />
                <ComboboxList>
                    {(value: string) => (
                        <ComboboxItem key={value} value={value}>
                            {value}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
            <output data-testid="selected">{selected.join(',')}</output>
        </Combobox>
    )
}

const frame = () => {
    const element = document.querySelector<HTMLElement>(
        '[data-slot="combobox-chips-trigger"]'
    )
    if (!element) throw new Error('Missing chips frame')
    return element
}

describe('select-style chips trigger', () => {
    it('opens from chip text and empty space, but removal only removes and keeps the dialog open', async () => {
        await render(
            <Dialog>
                <DialogTrigger>Open editor</DialogTrigger>
                <DialogContent>
                    <DialogTitle>Editor</DialogTitle>
                    <Example />
                </DialogContent>
            </Dialog>
        )
        const trigger = page.getByRole('combobox', {
            name: 'Choices',
            exact: true,
        })
        await page.getByRole('button', { name: 'Open editor' }).click()
        await expect.element(trigger).toHaveFocus()
        // Playwright must allow the overlay to receive the click at the chip's coordinates.
        await page.getByText('Alpha', { exact: true }).click({ force: true })
        await expect
            .element(page.getByRole('option', { name: 'Gamma' }))
            .toBeVisible()
        await expect
            .element(page.getByLabelText('Filter choices'))
            .toHaveFocus()
        await userEvent.keyboard('{Escape}')
        await expect.element(trigger).toHaveFocus()
        await page.getByRole('button', { name: 'Fjern Alpha' }).click()
        await expect
            .element(page.getByTestId('selected'))
            .toHaveTextContent('Beta')
        await expect
            .element(page.getByRole('dialog', { name: 'Editor' }))
            .toBeVisible()
        await expect.element(page.getByRole('option')).not.toBeInTheDocument()
        await expect.element(trigger).toHaveFocus()
        await page.getByRole('button', { name: 'Fjern Beta' }).click()
        await expect.element(page.getByTestId('selected')).toBeEmptyDOMElement()
        await trigger.click()
        await expect
            .element(page.getByRole('option', { name: 'Gamma' }))
            .toBeVisible()
    })

    it('forwards native props and ref, keyboard focus/open ring, and anchor width for arbitrary summary children', async () => {
        await render(<Example summary />)
        const trigger = page.getByRole('combobox', {
            name: 'Choices',
            exact: true,
        })
        await expect.element(trigger).toHaveAttribute('title', 'Choose values')
        expect(triggerRef.current).toBe(trigger.element())
        await userEvent.keyboard('{Tab}')
        triggerRef.current?.focus()
        await expect.element(trigger).toHaveFocus()
        expect(getComputedStyle(frame()).boxShadow).toContain('inset')
        for (const key of ['{Enter}', ' ']) {
            await userEvent.keyboard(key)
            await expect
                .element(trigger)
                .toHaveAttribute('aria-expanded', 'true')
            await expect
                .element(page.getByRole('option', { name: 'Gamma' }))
                .toBeVisible()
            const popup = document.querySelector<HTMLElement>(
                '[data-slot="combobox-content"]'
            )!
            expect(popup.getBoundingClientRect().width).toBeCloseTo(
                frame().getBoundingClientRect().width,
                0
            )
            expect(getComputedStyle(frame()).boxShadow).toContain('2px')
            await expect
                .element(page.getByLabelText('Filter choices'))
                .toHaveFocus()
            await userEvent.keyboard('{Escape}')
            await expect.element(trigger).toHaveFocus()
        }
        await page.getByText('2 selected').click({ force: true })
        await expect
            .element(page.getByRole('option', { name: 'Gamma' }))
            .toBeVisible()
    })

    it('preserves invalid styling and disables both selection and chip removal', async () => {
        await render(<Example disabled invalid />)
        const trigger = page.getByRole('combobox', { name: 'Choices' })
        await expect.element(trigger).toHaveAttribute('aria-invalid', 'true')
        await expect.element(trigger).toBeDisabled()
        await expect
            .element(page.getByRole('button', { name: 'Fjern Alpha' }))
            .toBeDisabled()
        expect(getComputedStyle(frame()).cursor).toBe('not-allowed')
        expect(getComputedStyle(frame()).borderTopColor).toBe(
            'rgb(211, 47, 47)'
        )
        await expect.element(page.getByRole('option')).not.toBeInTheDocument()
    })
})
