import { page, userEvent } from 'vitest/browser'
import { roleColour } from '../../../test/roleColour'
import { editable, renderForm } from './serve'

describe('blame with more contrast', () => {
    it('keeps the lines quiet and the buttons in their roles', async () => {
        await renderForm({}, { blame: 'markers' })
        await editable()
        await userEvent.click(
            page.getByRole('radio', { name: 'Male', exact: true })
        )
        const disclosure = page.getByRole('button', {
            name: '1 question hidden by rules',
        })
        await userEvent.click(disclosure)
        const line = page.getByText(/^Pregnant: hidden by rule/)
        await expect.element(line).toBeVisible()
        const colour = (element: Element) => getComputedStyle(element).color
        expect(colour(line.element())).toBe(roleColour('muted-foreground'))
        expect(colour(disclosure.element())).toBe(roleColour('foreground'))
        expect(
            colour(
                page.getByRole('button', { name: 'Why? Pregnant' }).element()
            )
        ).toBe(roleColour('primary'))
    })

    it('keeps the marker in its role', async () => {
        await renderForm({}, { blame: 'markers' })
        await editable()
        await userEvent.click(
            page.getByRole('textbox', { name: 'Weight (kg)' })
        )
        await userEvent.keyboard('150{Tab}')
        const marker = page.getByRole('button', {
            name: 'Set automatically, Paracetamol dose (mg): why',
        })
        await expect.element(marker).toBeVisible()
        expect(getComputedStyle(marker.element()).color).toBe(
            roleColour('foreground')
        )
    })
})
