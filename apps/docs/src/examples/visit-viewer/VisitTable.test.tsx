import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import VisitTable from './VisitTable'

it('shows each visit in a table row without stray list markup', async () => {
    const view = await render(<VisitTable />)
    await expect
        .element(
            view.getByRole('table', {
                name: 'Child health visits, newest first',
            })
        )
        .toBeVisible()
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(4)
    expect(view.container.querySelector('dd')).toBeNull()
    expect(view.container.querySelector('dt')).toBeNull()
    await expect
        .element(view.getByRole('row', { name: /14-week visit/ }))
        .toHaveTextContent('Growth monitoringSkipped')
    await expect
        .element(view.getByRole('button', { name: 'Open 6-month visit' }))
        .toBeVisible()
})
