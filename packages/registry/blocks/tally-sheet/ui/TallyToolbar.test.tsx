import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { onTestFinished } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TallySheet } from '..'
import { buttonIn, inputIn, listen } from '../test/sheet.test-utils'
import { tapOn, GIRL, VACCINATIONS } from '../test/tally.fixture'

describe('total', () => {
    it('counts every mark on the sheet', async () => {
        const screen = await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                defaultEntries={[tapOn('opv1', GIRL)]}
            />
        )
        await expect.element(screen.getByText('1 mark')).toBeVisible()
        await userEvent.click(buttonIn('Penta 1', 1))
        await expect.element(screen.getByText('2 marks')).toBeVisible()
    })
})

describe('undo', () => {
    it('takes back the last tap, says so, and keeps focus once it has nothing left', async () => {
        const heard = listen()
        const screen = await render(
            <TallySheet layout={VACCINATIONS} label="Tally" />
        )
        const undo = screen.getByRole('button', { name: 'Undo last mark' })
        await expect.element(undo).toHaveAttribute('aria-disabled', 'true')
        await userEvent.click(buttonIn('OPV 1', 1))
        await expect.element(undo).not.toHaveAttribute('aria-disabled', 'true')
        undo.element().focus()
        await userEvent.keyboard('{Enter}')
        await expect.element(buttonIn('OPV 1', 1)).toHaveTextContent('0')
        await expect
            .poll(() => heard.at(-1))
            .toBe('Undone: 6 weeks, OPV 1, 0–11 months, Male, now 0')
        await expect.element(undo).toHaveAttribute('aria-disabled', 'true')
        expect(document.activeElement).toBe(undo.element())
    })

    it('takes back a set of corrections at once', async () => {
        const heard = listen()
        const screen = await render(
            <TallySheet layout={VACCINATIONS} label="Tally" />
        )
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        await userEvent.fill(inputIn('OPV 1', 0), '4')
        await userEvent.fill(inputIn('Penta 1', 2), '9')
        await screen.getByRole('button', { name: 'Done' }).click()
        await expect.poll(() => heard.at(-1)).toBe('2 counts changed')
        await screen.getByRole('button', { name: 'Undo last mark' }).click()
        await expect.poll(() => heard.at(-1)).toBe('2 corrections undone')
        expect(buttonIn('OPV 1', 0).textContent).toBe('0')
        expect(buttonIn('Penta 1', 2).textContent).toBe('0')
    })

    it('is not shown while the counts are being edited', async () => {
        const screen = await render(
            <TallySheet layout={VACCINATIONS} label="Tally" />
        )
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        expect(
            screen.getByRole('button', { name: 'Undo last mark' }).query()
        ).toBeNull()
    })
})

describe('total on a right-to-left page', () => {
    it('keeps the number before the word, as written', async () => {
        await i18n.changeLanguage('ar')
        onTestFinished(() => i18n.changeLanguage('en'))
        const screen = await render(
            <div dir="rtl">
                <TallySheet
                    layout={VACCINATIONS}
                    label="Tally"
                    defaultEntries={[tapOn('opv1', GIRL), tapOn('opv1', GIRL)]}
                />
            </div>
        )
        const total = screen.getByText(
            `${new Intl.NumberFormat('ar').format(2)} marks`
        )
        await expect.element(total).toHaveAttribute('dir', 'auto')
        expect(getComputedStyle(total.element()).direction).toBe('ltr')
    })
})
