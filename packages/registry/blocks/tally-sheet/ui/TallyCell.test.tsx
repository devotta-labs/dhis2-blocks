import '../test/renders.test-utils'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { onTestFinished } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TallySheet } from '..'
import type { TallyEntry } from '..'
import { rendersDuring } from '../test/renders.test-utils'
import { buttonIn, inputIn, listen } from '../test/sheet.test-utils'
import { correctionOn, GIRL, VACCINATIONS } from '../test/tally.fixture'

const editing = async () => {
    await userEvent.click(
        document.querySelector('[data-slot="tally-edit-buttons"] button') ??
            document.body
    )
}

const done = async () => {
    const button = [
        ...document.querySelectorAll('[data-slot="tally-edit-buttons"] button'),
    ].find((each) => each.textContent === 'Done')
    if (button === undefined) throw new Error('No Done button')
    await userEvent.click(button)
}

describe('count buttons', () => {
    it('is a large button named by its headings and count, that a click adds one to', async () => {
        const heard = listen()
        const screen = await render(
            <TallySheet layout={VACCINATIONS} label="Tally" />
        )
        const button = buttonIn('OPV 1', 0)
        expect(button.textContent).toBe('0')
        expect(
            screen
                .getByRole('button', {
                    name: '6 weeks OPV 1 0–11 months Female 0',
                })
                .element()
        ).toBe(button)
        expect(button.className).toContain('touch-manipulation')
        expect(getComputedStyle(button).userSelect).toBe('none')
        expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(80)
        await userEvent.click(button)
        await userEvent.click(button)
        await expect.element(button).toHaveTextContent('2')
        await expect
            .poll(() => heard.at(-1))
            .toBe('6 weeks, OPV 1, 0–11 months, Female: 2')
    })

    it('writes counts in the language of the page', async () => {
        await i18n.changeLanguage('ar')
        onTestFinished(() => i18n.changeLanguage('en'))
        await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                defaultEntries={[correctionOn('opv1', GIRL, 1234)]}
            />
        )
        expect(buttonIn('OPV 1', 0).textContent).toBe(
            new Intl.NumberFormat('ar').format(1234)
        )
        expect(buttonIn('OPV 1', 0).textContent).not.toBe('1234')
    })

    it('takes one tap for a key held down', async () => {
        const appended: TallyEntry[] = []
        await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                onAppend={(made) => appended.push(...made)}
            />
        )
        buttonIn('OPV 1', 0).focus()
        await userEvent.keyboard('{Enter>3/}')
        const held = new KeyboardEvent('keydown', {
            key: ' ',
            repeat: true,
            bubbles: true,
            cancelable: true,
        })
        buttonIn('OPV 1', 0).dispatchEvent(held)
        expect(held.defaultPrevented).toBe(true)
        await expect.element(buttonIn('OPV 1', 0)).toHaveTextContent('1')
        expect(appended).toHaveLength(1)
    })

    it('renders the tapped cell and its row badge, nothing else', async () => {
        const Badge = ({ total }: { total: number }) => <span>{total}</span>
        await render(
            <TallySheet layout={VACCINATIONS} label="Tally" RowBadge={Badge} />
        )
        await userEvent.click(buttonIn('OPV 1', 0))
        await userEvent.hover(buttonIn('OPV 1', 1))
        buttonIn('OPV 1', 1).focus()
        await new Promise((resolve) => requestAnimationFrame(resolve))
        const renders = await rendersDuring(() =>
            userEvent.click(buttonIn('OPV 1', 1))
        )
        expect(renders.toSorted()).toEqual(
            ['Badge', 'HostBadge', 'RowBadgeSlot', 'TapCell'].toSorted()
        )
    })
})

describe('edit fields', () => {
    it('labels each field with its row and column headings', async () => {
        const screen = await render(
            <TallySheet layout={VACCINATIONS} label="Tally" />
        )
        await editing()
        const field = screen.getByRole('textbox', {
            name: 'Penta 1 12–23 months Male',
        })
        await expect.element(field).toHaveAttribute('inputmode', 'numeric')
        expect(field.element()).toBe(inputIn('Penta 1', 3))
        expect(document.querySelectorAll('td input')).toHaveLength(16)
    })

    it('keeps only digits, as ASCII, at most six', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        await editing()
        const field = inputIn('OPV 1', 0)
        await userEvent.click(field)
        await userEvent.keyboard('a1-2 b')
        await expect.element(field).toHaveValue('12')
        await userEvent.clear(field)
        await userEvent.keyboard('1234567')
        await expect.element(field).toHaveValue('123456')
        await userEvent.clear(field)
        await userEvent.keyboard('٤٢')
        await expect.element(field).toHaveValue('42')
        await done()
        await expect.element(buttonIn('OPV 1', 0)).toHaveTextContent('42')
    })

    it('selects the count on focus and puts it back when left empty', async () => {
        const heard = listen()
        await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                defaultEntries={[correctionOn('opv1', GIRL, 7)]}
            />
        )
        await editing()
        const field = inputIn('OPV 1', 0)
        await userEvent.click(field)
        expect([field.selectionStart, field.selectionEnd]).toEqual([0, 1])
        await userEvent.keyboard('{Backspace}')
        await expect.element(field).toHaveValue('')
        await userEvent.tab()
        await expect.element(field).toHaveValue('7')
        await done()
        await expect.element(buttonIn('OPV 1', 0)).toHaveTextContent('7')
        await expect.poll(() => heard.at(-1)).toBe('No counts changed')
    })

    it('moves up and down a column with the arrows and Enter, between fields only', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        await editing()
        inputIn('BCG', 0).focus()
        await userEvent.keyboard('{Enter}')
        expect(document.activeElement).toBe(inputIn('OPV 0', 0))
        await userEvent.keyboard('{ArrowDown}')
        expect(document.activeElement).toBe(inputIn('OPV 1', 0))
        await userEvent.keyboard('{ArrowUp}{ArrowUp}')
        expect(document.activeElement).toBe(inputIn('BCG', 0))
        inputIn('OPV 1', 2).focus()
        await userEvent.keyboard('{ArrowUp}')
        expect(document.activeElement).toBe(inputIn('OPV 1', 2))
        await userEvent.tab()
        expect(document.activeElement).toBe(inputIn('OPV 1', 3))
    })

    it('renders one field per keystroke', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        await editing()
        await userEvent.click(inputIn('OPV 1', 0))
        const renders = await rendersDuring(() => userEvent.keyboard('5'))
        expect(renders.filter((name) => name.endsWith('Cell'))).toEqual([
            'EditCell',
        ])
    })
})

describe('how a count is drawn', () => {
    it('draws a cell with nothing in it lighter than one with a count', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        const button = buttonIn('OPV 1', 0)
        expect(button).toHaveClass('text-dhis2-subtle-foreground')
        await userEvent.click(button)
        await expect.element(button).toHaveTextContent('1')
        expect(button).not.toHaveClass('text-dhis2-subtle-foreground')
    })

    it('draws five and six digits smaller, so they fit the cell', async () => {
        await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                defaultEntries={[
                    correctionOn('opv1', GIRL, 12_345),
                    correctionOn('penta1', GIRL, 123_456),
                    correctionOn('measles1', GIRL, 1234),
                ]}
            />
        )
        expect(buttonIn('OPV 1', 0)).toHaveClass('text-xl')
        expect(buttonIn('Penta 1', 0)).toHaveClass('text-lg')
        expect(buttonIn('Measles 1', 0)).toHaveClass('text-2xl')
        const cell = buttonIn('Penta 1', 0)
        expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth)
    })
})
