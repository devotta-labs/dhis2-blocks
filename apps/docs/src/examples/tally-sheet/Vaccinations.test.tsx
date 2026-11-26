import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import Vaccinations from './Vaccinations'

it('closes birth doses after 12 months and lists the counts as data values', async () => {
    const view = await render(<Vaccinations />)
    const sheet = view.getByRole('grid', { name: 'Immunisation tally' })
    const bcg = sheet.getByRole('row', { name: /^BCG/ })
    await expect.element(bcg.getByRole('button').nth(1)).toBeVisible()
    expect(bcg.getByRole('button').elements()).toHaveLength(2)
    expect(bcg.getByText('Not used').elements()).toHaveLength(2)
    await expect.element(view.getByText('At birth')).toBeVisible()

    await bcg.getByRole('button').first().click()
    await bcg.getByRole('button').first().click()
    await sheet
        .getByRole('row', { name: /^Penta 1/ })
        .getByRole('button')
        .nth(3)
        .click()

    const values = view.getByRole('table', { name: 'Data values' })
    await expect
        .element(values.getByRole('row', { name: 'BCG 0–11 months, Female 2' }))
        .toBeVisible()
    await expect
        .element(
            values.getByRole('row', { name: 'Penta 1 12–23 months, Male 1' })
        )
        .toBeVisible()
    expect(values.getByRole('row').elements()).toHaveLength(3)
})
