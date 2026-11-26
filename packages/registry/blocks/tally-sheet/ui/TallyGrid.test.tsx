import '../test/renders.test-utils'
import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { roleColour } from '../../../test/roleColour'
import { TallySheet } from '..'
import { rendersDuring } from '../test/renders.test-utils'
import {
    buttonIn,
    cellIn,
    inputIn,
    listen,
    rowHeaderOf,
} from '../test/sheet.test-utils'
import {
    correctionOn,
    OLDER_GIRL,
    VACCINATIONS,
    VITAMIN_A,
} from '../test/tally.fixture'

const POINTED = 'bg-dhis2-info-subtle'

const columnHeader = (label: string) => {
    const header = [
        ...document.querySelectorAll<HTMLElement>('th[scope="col"]'),
    ].find((th) => th.textContent === label)
    if (header === undefined) throw new Error(`No column ${label}`)
    return header
}

describe('grid semantics', () => {
    it('is a labelled grid in a labelled region, with a header row per category', async () => {
        const screen = await render(
            <TallySheet layout={VACCINATIONS} label="Immunisation tally" />
        )
        await expect
            .element(
                screen
                    .getByRole('region', { name: 'Immunisation tally' })
                    .last()
            )
            .toHaveAttribute('data-slot', 'tally-scroll')
        const grid = screen.getByRole('grid', { name: 'Immunisation tally' })
        await expect.element(grid).toBeVisible()
        expect(grid.element().tagName).toBe('TABLE')
        const headerRows = grid.element().querySelectorAll('thead tr')
        expect(headerRows).toHaveLength(2)
        const outer = [...(headerRows[0]?.querySelectorAll('th') ?? [])]
        expect(outer.map((th) => [th.textContent, th.colSpan])).toEqual([
            ['0–11 months', 2],
            ['12–23 months', 2],
        ])
        const inner = [...(headerRows[1]?.querySelectorAll('th') ?? [])]
        expect(inner.map((th) => th.textContent)).toEqual([
            'Female',
            'Male',
            'Female',
            'Male',
        ])
        expect(inner.every((th) => th.scope === 'col')).toBe(true)
    })

    it('heads each row with its label and badge, and draws groups in their own bodies', async () => {
        const Badge = ({ total }: { total: number }) =>
            total > 0 ? <span>Alert</span> : null
        await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                RowBadge={Badge}
                defaultEntries={[correctionOn('penta1', OLDER_GIRL, 3)]}
            />
        )
        const header = rowHeaderOf('Penta 1')
        expect(header.getAttribute('scope')).toBe('row')
        expect(header.querySelector('[dir="auto"]')?.textContent).toBe(
            'Penta 1'
        )
        expect(header.textContent).toContain('Alert')
        expect(rowHeaderOf('BCG').textContent).not.toContain('Alert')
        const bodies = [...document.querySelectorAll('tbody')]
        expect(
            bodies.map((body) => [
                body.querySelector('th[scope="rowgroup"]')?.textContent,
                body
                    .querySelector('th[scope="rowgroup"]')
                    ?.getAttribute('colspan'),
                [...body.querySelectorAll('th[scope="row"]')].map(
                    (th) => th.textContent
                ),
            ])
        ).toEqual([
            ['At birth', '5', ['BCG', 'OPV 0']],
            ['6 weeks', '5', ['OPV 1', 'Penta 1Alert']],
            ['9 months', '5', ['Measles 1']],
        ])
    })

    it('needs no group heading for rows without a group', async () => {
        await render(<TallySheet layout={VITAMIN_A} label="Vitamin A" />)
        expect(document.querySelectorAll('th[scope="rowgroup"]')).toHaveLength(
            0
        )
        expect(document.querySelectorAll('tbody')).toHaveLength(1)
    })

    it('scrolls inside its region at 320 pixels rather than squeezing the counts', async () => {
        await render(
            <div style={{ width: 320 }}>
                <TallySheet layout={VACCINATIONS} label="Tally" />
            </div>
        )
        const region = page
            .getByRole('region', { name: 'Tally' })
            .last()
            .element()
        expect(region.scrollWidth).toBeGreaterThan(region.clientWidth)
        for (const button of document.querySelectorAll('td button')) {
            expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(
                72
            )
        }
        expect(
            rowHeaderOf('Measles 1').getBoundingClientRect().width
        ).toBeLessThanOrEqual(region.clientWidth * 0.4 + 1)
        const sticky = getComputedStyle(rowHeaderOf('BCG'))
        expect(sticky.position).toBe('sticky')
        expect(
            getComputedStyle(document.querySelector('thead') ?? region).position
        ).toBe('sticky')
    })
})

describe('closed cells', () => {
    it('hatches a closed cell with no control, said as not used', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        const closed = cellIn('BCG', 2)
        expect(closed.querySelector('button')).toBeNull()
        expect(closed.querySelector('.sr-only')?.textContent).toBe('Not used')
        const hatch = closed.querySelector('[data-slot="tally-closed"]')
        if (hatch === null) throw new Error('No hatch')
        const { backgroundImage, backgroundColor } = getComputedStyle(hatch)
        const line = backgroundImage.match(/rgba?\([^)]*\)|color\([^)]*\)/)?.[0]
        expect(line).toBe(roleColour('border-strong'))
        expect(backgroundColor).toBe(roleColour('background'))
    })

    it('shows a count a joined log put in a closed cell, and lets it be put right', async () => {
        const screen = await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                defaultEntries={[correctionOn('bcg', OLDER_GIRL, 2)]}
            />
        )
        expect(cellIn('BCG', 2).textContent).toBe('2Not used')
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        await expect.element(inputIn('BCG', 2)).toHaveValue('2')
        expect(cellIn('BCG', 3).querySelector('input')).toBeNull()
    })
})

describe('keys', () => {
    it('is one tab stop, on the first open cell, then on the last cell focused', async () => {
        const screen = await render(
            <TallySheet layout={VACCINATIONS} label="Tally" />
        )
        const stops = [...document.querySelectorAll('td button')].filter(
            (button) => button.getAttribute('tabindex') === '0'
        )
        expect(stops).toEqual([buttonIn('BCG', 0)])
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        await screen.getByRole('button', { name: 'Cancel' }).click()
        await userEvent.tab()
        expect(document.activeElement).toBe(buttonIn('BCG', 0))
        await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}')
        expect(document.activeElement).toBe(buttonIn('OPV 1', 1))
        await userEvent.tab({ shift: true })
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Edit counts' }).element()
        )
        await userEvent.tab()
        expect(document.activeElement).toBe(buttonIn('OPV 1', 1))
    })

    it('moves between open cells, skipping closed ones', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        buttonIn('OPV 0', 1).focus()
        await userEvent.keyboard('{ArrowRight}')
        expect(document.activeElement).toBe(buttonIn('OPV 0', 1))
        buttonIn('OPV 1', 2).focus()
        await userEvent.keyboard('{ArrowUp}')
        expect(document.activeElement).toBe(buttonIn('OPV 1', 2))
        await userEvent.keyboard('{ArrowDown}{ArrowDown}')
        expect(document.activeElement).toBe(buttonIn('Measles 1', 2))
        await userEvent.keyboard('{Home}')
        expect(document.activeElement).toBe(buttonIn('Measles 1', 0))
        await userEvent.keyboard('{End}')
        expect(document.activeElement).toBe(buttonIn('Measles 1', 3))
        buttonIn('OPV 0', 0).focus()
        await userEvent.keyboard('{End}')
        expect(document.activeElement).toBe(buttonIn('OPV 0', 1))
        await userEvent.keyboard('{Control>}{End}{/Control}')
        expect(document.activeElement).toBe(buttonIn('Measles 1', 3))
        await userEvent.keyboard('{Control>}{Home}{/Control}')
        expect(document.activeElement).toBe(buttonIn('BCG', 0))
    })

    it('mirrors left and right in a right-to-left page', async () => {
        await render(
            <div dir="rtl">
                <TallySheet layout={VACCINATIONS} label="Tally" />
            </div>
        )
        buttonIn('OPV 1', 0).focus()
        await userEvent.keyboard('{ArrowLeft}')
        expect(document.activeElement).toBe(buttonIn('OPV 1', 1))
        await userEvent.keyboard('{ArrowRight}')
        expect(document.activeElement).toBe(buttonIn('OPV 1', 0))
        expect(getComputedStyle(rowHeaderOf('BCG')).insetInlineStart).toBe(
            '0px'
        )
    })
})

describe('headings of the cell in hand', () => {
    it('highlights the pointed cell, then the focused one when the pointer leaves', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        buttonIn('OPV 1', 0).focus()
        await expect.element(rowHeaderOf('OPV 1')).toHaveClass(POINTED)
        await userEvent.hover(buttonIn('Penta 1', 3))
        await expect.element(rowHeaderOf('Penta 1')).toHaveClass(POINTED)
        await expect.element(columnHeader('12–23 months')).toHaveClass(POINTED)
        await expect.element(rowHeaderOf('OPV 1')).not.toHaveClass(POINTED)
        expect(document.querySelectorAll(`th.${POINTED}`)).toHaveLength(3)
        await userEvent.unhover(buttonIn('Penta 1', 3))
        await userEvent.hover(page.getByText('Tally', { exact: true }))
        await expect.element(rowHeaderOf('OPV 1')).toHaveClass(POINTED)
        await expect.element(columnHeader('0–11 months')).toHaveClass(POINTED)
        await expect.element(rowHeaderOf('Penta 1')).not.toHaveClass(POINTED)
    })

    it('leaves no highlight behind a touch', async () => {
        const screen = await render(
            <>
                <p>Away</p>
                <TallySheet layout={VACCINATIONS} label="Tally" />
            </>
        )
        await userEvent.hover(screen.getByText('Away'))
        buttonIn('OPV 1', 0).dispatchEvent(
            new PointerEvent('pointerover', {
                bubbles: true,
                pointerType: 'touch',
            })
        )
        await new Promise((resolve) => requestAnimationFrame(resolve))
        expect(document.querySelectorAll(`th.${POINTED}`)).toHaveLength(0)
    })

    it('renders only headings as the pointer moves', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        await userEvent.hover(buttonIn('BCG', 0))
        const renders = await rendersDuring(() =>
            userEvent.hover(buttonIn('Penta 1', 3))
        )
        expect(new Set(renders)).toEqual(new Set(['RowHeader', 'ColumnHeader']))
    })
})

const overlaps = (a: DOMRect, b: DOMRect) =>
    a.left < b.right - 0.5 && b.left < a.right - 0.5

describe('focus kept clear of the sticky headings', () => {
    it.each(['ltr', 'rtl'])(
        'keeps a focused cell out from under the row headings at 320 pixels (%s)',
        async (dir) => {
            await render(
                <div dir={dir} style={{ width: 320 }}>
                    <TallySheet layout={VACCINATIONS} label="Tally" />
                </div>
            )
            const clear = () => {
                const focused = document.activeElement
                if (!(focused instanceof HTMLElement))
                    throw new Error('No focus')
                const header = focused.closest('tr')?.querySelector('th')
                if (!header) throw new Error('No row header')
                expect(
                    overlaps(
                        focused.getBoundingClientRect(),
                        header.getBoundingClientRect()
                    )
                ).toBe(false)
            }
            const forward = dir === 'rtl' ? '{ArrowLeft}' : '{ArrowRight}'
            const back = dir === 'rtl' ? '{ArrowRight}' : '{ArrowLeft}'
            buttonIn('OPV 1', 0).focus()
            clear()
            await userEvent.keyboard('{End}')
            clear()
            await userEvent.keyboard('{Home}')
            clear()
            for (const key of [forward, forward, forward, back, back, back]) {
                await userEvent.keyboard(key)
                clear()
            }
        }
    )
})

const CLINICS = {
    categories: [
        {
            id: 'sex',
            label: 'Sex',
            options: [
                { id: 'female', label: 'Female' },
                { id: 'male', label: 'Male' },
            ],
        },
    ],
    rows: [
        { id: 'north', label: 'Dose 1', group: 'North clinic' },
        { id: 'south', label: 'Dose 1', group: 'South clinic' },
    ],
}

const southButton = () => {
    const button = document
        .querySelectorAll('tbody')[1]
        ?.querySelector('td button')
    if (!(button instanceof HTMLButtonElement)) throw new Error('No button')
    return button
}

describe('rows that share a label under two groups', () => {
    it('names the group in announcements and in the edit fields', async () => {
        const heard = listen()
        const screen = await render(
            <TallySheet layout={CLINICS} label="Doses" />
        )
        await userEvent.click(southButton())
        await expect
            .poll(() => heard.at(-1))
            .toBe('South clinic, Dose 1, Female: 1')
        await screen.getByRole('button', { name: 'Undo last mark' }).click()
        await expect
            .poll(() => heard.at(-1))
            .toBe('Undone: South clinic, Dose 1, Female, now 0')
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        await expect
            .element(
                screen.getByRole('textbox', {
                    name: 'North clinic Dose 1 Female',
                })
            )
            .toBeVisible()
        await expect
            .element(
                screen.getByRole('textbox', {
                    name: 'South clinic Dose 1 Male',
                })
            )
            .toBeVisible()
    })
})
