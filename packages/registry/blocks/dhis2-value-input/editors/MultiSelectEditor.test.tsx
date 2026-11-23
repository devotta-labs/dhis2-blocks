import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { MultiSelectEditor, MultiSelectFormEditor } from './MultiSelectEditor'

const MANY: Field = {
    valueType: 'MULTI_TEXT',
    options: Array.from({ length: 60 }, (_, index) => ({
        code: `O${index + 1}`,
        name: `Option ${index + 1}`,
    })),
}
const COUNT = 'Showing 50 of 60 matches'

const mount = async (inForm: boolean) => {
    const announcement = Promise.withResolvers<string>()
    const messages: string[] = []
    const announce = (message: string) => {
        messages.push(message)
        announcement.resolve(message)
    }
    const props = {
        field: MANY,
        value: undefined,
        settings: { calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' },
        labelledBy: 'label',
        save: () => 'queued' as const,
        report: () => undefined,
        announce,
    } as const
    await render(
        <>
            <span id="label">Symptoms</span>
            {inForm ? (
                <MultiSelectFormEditor {...props} />
            ) : (
                <MultiSelectEditor {...props} cancel={() => undefined} />
            )}
        </>
    )
    return { messages, announced: announcement.promise }
}

test('in a form, the count is said once the combobox is typed in, not when the editor appears', async () => {
    const { messages, announced } = await mount(true)
    const search = page.getByRole('combobox', { name: 'Symptoms' })
    await expect.element(search).toBeVisible()
    expect(messages).toEqual([])

    await userEvent.click(search)
    await userEvent.keyboard('option')
    expect(await announced).toBe(COUNT)
    expect(messages).toEqual([COUNT])
})

test('in a dialog, the count is shown and said when the editor opens', async () => {
    const { messages, announced } = await mount(false)
    await expect.element(page.getByText(COUNT)).toBeVisible()
    expect(await announced).toBe(COUNT)
    expect(messages).toEqual([COUNT])
})
