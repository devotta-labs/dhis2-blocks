import { CustomDataProvider } from '@dhis2/app-runtime'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ValueInput } from '../ValueInput'

const mount = async (value?: string) => {
    const onChange = vi.fn()
    await render(
        <CustomDataProvider data={{}}>
            <ValueInput
                field={{ valueType: 'COORDINATE' }}
                settings={{ calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' }}
                label="Location"
                value={value}
                onChange={onChange}
            />
            <button type="button">After</button>
            <input aria-label="Copied" />
        </CustomDataProvider>
    )
    return {
        onChange,
        leave: () => page.getByRole('button', { name: 'After' }).click(),
    }
}

const latitude = page.getByRole('textbox', { name: 'Latitude' })
const longitude = page.getByRole('textbox', { name: 'Longitude' })

const paste = async (text: string, into: typeof latitude) => {
    const copied = page.getByRole('textbox', { name: 'Copied' })
    await userEvent.fill(copied, text)
    await userEvent.tripleClick(copied)
    await userEvent.copy()
    await userEvent.click(into)
    await userEvent.keyboard('{End}')
    await userEvent.paste()
}

test('a whole coordinate typed in one field fills both when it is left, and is reported', async () => {
    const { onChange, leave } = await mount()
    for (const [text, lat, lng] of [
        ['8.4871, -13.2356', '8.4871', '-13.2356'],
        [`8°29'13.6"N 13°14'08.2"W`, '8.487111', '-13.235611'],
        [
            'https://www.google.com/maps/@8.4871,-13.2356,15z',
            '8.4871',
            '-13.2356',
        ],
    ]) {
        await userEvent.fill(longitude, '')
        await userEvent.fill(latitude, text)
        await userEvent.click(longitude)
        await expect.element(latitude).toHaveValue(lat)
        await expect.element(longitude).toHaveValue(lng)
    }
    await leave()
    expect(onChange.mock.calls.at(-1)).toEqual(['[-13.2356,8.4871]', undefined])
})

test('a whole coordinate pasted in one field fills both at once, replacing what they held', async () => {
    const { onChange, leave } = await mount('[2,1]')
    await paste('8.4871, -13.2356', latitude)
    await expect.element(latitude).toHaveValue('8.4871')
    await expect.element(longitude).toHaveValue('-13.2356')
    await leave()
    expect(onChange.mock.calls.at(-1)).toEqual(['[-13.2356,8.4871]', undefined])
})

test('undo after a paste filled both brings back what they held', async () => {
    await mount('[2,1]')
    await paste('8.4871, -13.2356', longitude)
    await expect.element(latitude).toHaveValue('8.4871')
    await userEvent.keyboard('{Control>}z{/Control}')
    await expect.element(latitude).toHaveValue('1')
    await expect.element(longitude).toHaveValue('2')
})

test('text with no coordinate in it is pasted as typed, and refused as typed text is', async () => {
    const { onChange, leave } = await mount()
    await paste('Bo town', latitude)
    await expect.element(latitude).toHaveValue('Bo town')
    await expect.element(longitude).toHaveValue('')
    await leave()
    expect(onChange.mock.calls.at(-1)).toEqual([
        null,
        {
            message: 'Enter a latitude between -90 and 90',
            text: 'Bo town, ',
        },
    ])
})

test('a number alone stays in its field, while it is typed and once it is left', async () => {
    const { onChange, leave } = await mount()
    for (const typed of ['8', '8.', '8.4871', '8,48']) {
        await userEvent.fill(latitude, typed)
        await expect.element(latitude).toHaveValue(typed)
        await expect.element(longitude).toHaveValue('')
    }
    await userEvent.click(longitude)
    await expect.element(latitude).toHaveValue('8,48')
    await expect.element(longitude).toHaveValue('')
    await userEvent.fill(latitude, '8.4871')
    await userEvent.fill(longitude, '-13.2')
    await leave()
    expect(onChange.mock.calls.at(-1)).toEqual(['[-13.2,8.4871]', undefined])
})

test('a whole coordinate being typed is not rewritten under the cursor', async () => {
    await mount()
    await userEvent.click(latitude)
    await userEvent.keyboard('8.4871, -13.2')
    await expect.element(latitude).toHaveValue('8.4871, -13.2')
    await expect.element(longitude).toHaveValue('')
    await userEvent.keyboard('356')
    await expect.element(latitude).toHaveValue('8.4871, -13.2356')
})

test('a pair with decimal commas is left as typed, never split', async () => {
    const { onChange, leave } = await mount()
    await paste('8,48, -13,23', latitude)
    await expect.element(latitude).toHaveValue('8,48, -13,23')
    await expect.element(longitude).toHaveValue('')
    await leave()
    await expect.element(latitude).toHaveValue('8,48, -13,23')
    expect(onChange.mock.calls.at(-1)?.[0]).toBeNull()
})
