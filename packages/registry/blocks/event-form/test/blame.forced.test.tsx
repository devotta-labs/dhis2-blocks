import { page, userEvent } from 'vitest/browser'
import { editable, renderForm } from './serve'

const open = async () => {
    await renderForm({}, { blame: 'markers' })
    await editable()
    await userEvent.click(
        page.getByRole('radio', { name: 'Male', exact: true })
    )
    const disclosure = page.getByRole('button', {
        name: '1 question hidden by rules',
    })
    await userEvent.click(disclosure)
    const why = page.getByRole('button', { name: 'Why? Pregnant' })
    await expect.element(why).toBeVisible()
    return { disclosure: disclosure.element(), why: why.element() }
}

const canvas = () => {
    const probe = document.createElement('span')
    probe.style.backgroundColor = 'Canvas'
    document.body.append(probe)
    const { backgroundColor } = getComputedStyle(probe)
    probe.remove()
    return backgroundColor
}

describe('blame in forced colours', () => {
    it('keeps the disclosure and Why? apart from the page', async () => {
        const { disclosure, why } = await open()
        expect(getComputedStyle(disclosure).color).not.toBe(canvas())
        expect(getComputedStyle(why).color).not.toBe(canvas())
    })

    it('outlines the focused disclosure and Why?', async () => {
        const { disclosure, why } = await open()
        await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}')
        await expect.poll(() => document.activeElement).toBe(disclosure)
        expect(getComputedStyle(disclosure).outlineStyle).toBe('solid')
        await userEvent.keyboard('{Tab}')
        await expect.poll(() => document.activeElement).toBe(why)
        expect(getComputedStyle(why).outlineStyle).toBe('solid')
    })

    it('keeps the marker apart from the page and outlines it when focused', async () => {
        await renderForm({}, { blame: 'markers' })
        await editable()
        const weight = page.getByRole('textbox', { name: 'Weight (kg)' })
        await userEvent.click(weight)
        await userEvent.keyboard('150{Tab}')
        const marker = page
            .getByRole('button', {
                name: 'Set automatically, Paracetamol dose (mg): why',
            })
            .element()
        expect(getComputedStyle(marker).color).not.toBe(canvas())
        await userEvent.click(
            page.getByRole('textbox', { name: 'Temperature (°C)' })
        )
        await userEvent.keyboard('{Tab}')
        await expect.poll(() => document.activeElement).toBe(marker)
        expect(getComputedStyle(marker).outlineStyle).toBe('solid')
    })
})
