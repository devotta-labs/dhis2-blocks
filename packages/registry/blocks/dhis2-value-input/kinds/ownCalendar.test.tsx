import { CustomDataProvider } from '@dhis2/app-runtime'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { ValueInput } from '../ValueInput'

const SETTINGS: ValueSettings = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}

// Only a field's own calendar is still the field: a popover the whole form sits in is not.
test('a field in a popover is reported when focus moves to another control in that popover', async () => {
    const onChange = vi.fn()
    await render(
        <CustomDataProvider data={{}}>
            <div data-slot="popover-content">
                <ValueInput
                    field={{ valueType: 'NUMBER' }}
                    settings={SETTINGS}
                    label="Temperature"
                    value={undefined}
                    onChange={onChange}
                />
                <button type="button">Save</button>
            </div>
        </CustomDataProvider>
    )
    await userEvent.fill(
        page.getByRole('textbox', { name: 'Temperature' }),
        '37.5'
    )
    await userEvent.click(page.getByRole('button', { name: 'Save' }))
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('37.5')
})

test('an editor in a popover is reported when focus moves to another control in that popover', async () => {
    const onChange = vi.fn()
    await render(
        <CustomDataProvider data={{}}>
            <div data-slot="popover-content">
                <ValueInput
                    field={{ valueType: 'COORDINATE' }}
                    settings={SETTINGS}
                    label="Location"
                    value={undefined}
                    onChange={onChange}
                />
                <button type="button">Save</button>
            </div>
        </CustomDataProvider>
    )
    await userEvent.fill(page.getByRole('textbox', { name: 'Latitude' }), '8')
    await userEvent.fill(page.getByRole('textbox', { name: 'Longitude' }), '10')
    await userEvent.click(page.getByRole('button', { name: 'Save' }))
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('[10,8]')
})
