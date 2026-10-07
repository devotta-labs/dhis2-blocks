import React from 'react'
import { render } from 'vitest-browser-react'
import { ContextSelectorShowcase } from './ContextSelectorShowcase'

const clickRenderedElement = (element: Element) => {
    if (!(element instanceof HTMLElement)) {
        throw new Error('Expected an HTML element')
    }

    element.click()
}

describe.sequential('ContextSelectorShowcase', () => {
    it('renders and controls every public context-selector primitive', async () => {
        const screen = await render(<ContextSelectorShowcase />)

        await expect
            .element(
                screen.getByRole('navigation', {
                    name: 'Context selector showcase',
                })
            )
            .toBeVisible()

        for (const dataTest of [
            'program-selector-container',
            'org-unit-selector-container',
        ]) {
            expect(
                screen.container.querySelector(`[data-test="${dataTest}"]`)
            ).not.toBeNull()
        }

        await screen
            .getByRole('button', {
                name: /Program.*Malaria case registration/,
            })
            .click()
        await expect
            .element(screen.getByRole('button', { name: 'Clear selections' }))
            .toBeVisible()
        await expect
            .element(screen.getByPlaceholder('Search programs'))
            .toBeVisible()
        await screen.getByPlaceholder('Search programs').fill('tuber')
        clickRenderedElement(screen.getByText('Tuberculosis program').element())
        await expect
            .element(
                screen.getByRole('button', {
                    name: /Program.*Tuberculosis program/,
                })
            )
            .toBeVisible()

        await screen
            .getByRole('button', {
                name: /Organisation unit.*Ngelehun CHC/,
            })
            .click()
        clickRenderedElement(
            screen
                .getByRole('button', { name: 'Select Njandama MCHP' })
                .element()
        )
        await expect
            .element(
                screen.getByRole('button', {
                    name: /Organisation unit.*Njandama MCHP/,
                })
            )
            .toBeVisible()

        await screen
            .getByLabelText('Visible selectors')
            .selectOptions('related')

        for (const dataTest of [
            'enrollment-selector-container',
            'stage-selector-container',
            'event-selector-container',
            'tracked entity type-selector-container',
        ]) {
            expect(
                screen.container.querySelector(`[data-test="${dataTest}"]`)
            ).not.toBeNull()
        }

        await expect
            .element(screen.getByText('Category', { exact: true }))
            .toBeVisible()
        await expect.element(screen.getByText('Default')).toBeVisible()

        await screen
            .getByRole('button', { name: /Enrollment.*Active enrollment/ })
            .click()
        clickRenderedElement(screen.getByText(/Completed enrollment/).element())
        await expect
            .element(
                screen.getByRole('button', {
                    name: /Enrollment.*Completed enrollment/,
                })
            )
            .toBeVisible()

        await screen
            .getByRole('button', { name: /Stage.*Clinical follow-up/ })
            .click()
        clickRenderedElement(screen.getByText('Laboratory result').element())
        await expect
            .element(
                screen.getByRole('button', {
                    name: /Stage.*Laboratory result/,
                })
            )
            .toBeVisible()

        await screen
            .getByRole('button', { name: /Visit date.*24 Aug 2026/ })
            .click()
        clickRenderedElement(screen.getByText('12 Jul 2026').element())
        await expect
            .element(
                screen.getByRole('button', {
                    name: /Visit date.*12 Jul 2026/,
                })
            )
            .toBeVisible()

        await screen
            .getByRole('button', { name: /Tracked entity type.*Person/ })
            .click()
        clickRenderedElement(screen.getByText('Household').element())
        await expect
            .element(
                screen.getByRole('button', {
                    name: /Tracked entity type.*Household/,
                })
            )
            .toBeVisible()

        const categoryItem = screen
            .getByText('Category', { exact: true })
            .element()
            .closest('.selector-bar-item')

        const categoryClear = categoryItem?.querySelector<HTMLElement>(
            '[data-test$="-clear-icon"]'
        )

        expect(categoryClear).not.toBeNull()
        categoryClear?.click()
        await expect.element(screen.getByText('No category')).toBeVisible()

        await screen
            .getByLabelText('Visible selectors')
            .selectOptions('primary')
        const state = screen.getByLabelText('Selector state')

        await state.selectOptions('loading')
        expect(
            screen.container.querySelectorAll(
                '[aria-label="Loading context options"]'
            )
        ).toHaveLength(2)

        await state.selectOptions('disabled')

        const disabledProgram = screen.container.querySelector(
            '[data-test="program-selector-container"]'
        )

        if (!(disabledProgram instanceof HTMLElement)) {
            throw new Error('Expected the disabled program selector to render')
        }

        disabledProgram.click()
        expect(screen.getByPlaceholder('Search programs').query()).toBeNull()

        await state.selectOptions('readOnly')
        expect(
            screen.container.querySelector(
                '[data-test="program-selector-container"] [aria-expanded="true"]'
            )
        ).toBeNull()

        await state.selectOptions('interactive')
        await screen.getByRole('button', { name: 'Clear selections' }).click()
        await expect
            .element(
                screen.getByRole('button', {
                    name: /Program.*Choose a program/,
                })
            )
            .toBeVisible()
        await expect
            .element(screen.getByRole('button', { name: 'Clear selections' }))
            .toBeDisabled()
    })
})
