import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import AlertThreshold from './AlertThreshold'

const spoken = () =>
    document.querySelector('[aria-live="polite"]')?.textContent ?? ''

it('marks a row Alert and says so once its total reaches the threshold', async () => {
    const view = await render(<AlertThreshold />)
    const measles = view.getByRole('row', { name: /^Measles/ })
    const bloody = view.getByRole('row', { name: /^Bloody diarrhoea/ })
    await expect.element(measles.getByText('Alert')).not.toBeInTheDocument()

    await measles.getByRole('button').first().click()
    await expect.element(measles.getByText('Alert')).toBeVisible()
    await expect.poll(spoken).toBe('Measles: alert threshold reached')

    for (let tap = 0; tap < 4; tap++) {
        await bloody.getByRole('button').nth(tap).click()
    }
    await expect.element(bloody.getByText('Alert')).not.toBeInTheDocument()
    await bloody.getByRole('button').first().click()
    await expect.element(bloody.getByText('Alert')).toBeVisible()
    await expect.poll(spoken).toBe('Bloody diarrhoea: alert threshold reached')
})
