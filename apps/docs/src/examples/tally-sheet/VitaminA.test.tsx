import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import VitaminA from './VitaminA'

it('counts a tap in its cell and the total, and takes it back with Undo', async () => {
    const view = await render(<VitaminA />)
    await expect
        .element(view.getByRole('grid', { name: 'Vitamin A doses' }))
        .toBeVisible()
    const refugee = view
        .getByRole('row', { name: /^Dose 1/ })
        .getByRole('button')
        .first()
    await refugee.click()
    await refugee.click()
    await expect.element(refugee).toHaveTextContent('2')
    await expect.element(view.getByText('2 marks')).toBeVisible()

    await view.getByRole('button', { name: 'Undo last mark' }).click()
    await expect.element(refugee).toHaveTextContent('1')
    await expect
        .element(view.getByText('1 mark', { exact: true }))
        .toBeVisible()
})
