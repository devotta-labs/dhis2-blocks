import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { MultiSelectEditor } from './MultiSelectEditor'

const MANY: Field = {
    valueType: 'MULTI_TEXT',
    options: Array.from({ length: 60 }, (_, index) => ({
        code: `O${index + 1}`,
        name: `Option ${index + 1}`,
    })),
}
const COUNT = 'Showing 50 of 60 matches'

/** The multi-select over 60 options, inline in a form or in a cell's dialog, and what it says. */
const mount = async (inline: boolean) => {
    const announce = vi.fn()
    await render(
        <>
            <span id="label">Symptoms</span>
            <MultiSelectEditor
                inline={inline}
                field={MANY}
                value={undefined}
                settings={{ calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' }}
                labelledBy="label"
                save={() => 'queued'}
                report={() => undefined}
                cancel={() => undefined}
                announce={announce}
            />
        </>
    )
    return { announce }
}

test('inline, the count is said once the combobox is typed in, not when the editor appears', async () => {
    const { announce } = await mount(true)
    const search = page.getByRole('combobox', { name: 'Symptoms' })
    await expect.element(search).toBeVisible()
    expect(announce).not.toHaveBeenCalled()

    await userEvent.click(search)
    await userEvent.keyboard('option')
    await expect.poll(() => announce.mock.calls).toEqual([[COUNT]])
})

test('in a dialog, the count is shown and said when the editor opens', async () => {
    const { announce } = await mount(false)
    await expect.element(page.getByText(COUNT)).toBeVisible()
    await expect.poll(() => announce.mock.calls).toEqual([[COUNT]])
})
