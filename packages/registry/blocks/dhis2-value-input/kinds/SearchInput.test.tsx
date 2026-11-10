import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import { useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { ValueInput } from '../ValueInput'
import type { ValueInputProps } from '../ValueInput'

const SETTINGS: ValueSettings = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}
const LABEL = 'Place of birth'
const CHC = 'DiszpKrYNg8'

const orgUnit = (id: string, displayName: string) => ({
    id,
    displayName,
    ancestors: [{ displayName: 'Sierra Leone' }, { displayName: 'Bo' }],
})

/** What the app runtime knows of the connection, as an app's service worker would say it: the server is unreachable. */
const DISCONNECTED = {
    pwaEnabled: true,
    latestIsConnected: false,
    subscribeToDhis2ConnectionStatus: () => () => undefined,
    startRecording: async () => undefined,
    getCachedSections: async () => [],
    removeSection: async () => false,
}

/**
 * An org unit field in a form that keeps the value it is told, over a server whose org units start "Ngelehun" and
 * whose one user is "admin"; offline, the runtime says the server cannot be reached.
 */
const mount = async (
    props: Partial<ValueInputProps> = {},
    { offline = false } = {}
) => {
    const onChange = vi.fn()
    const queries: unknown[] = []
    const Host = () => {
        const [value, setValue] = useState(props.value)
        return (
            <CustomDataProvider
                data={{
                    organisationUnits: async (_type, { params }) => {
                        queries.push(params?.query)
                        const found = [
                            orgUnit(CHC, 'Ngelehun CHC'),
                            orgUnit('FwKJ7gYEv8U', 'Ngelehun MCHP'),
                        ].filter(({ displayName }) =>
                            displayName.startsWith(String(params?.query))
                        )
                        return {
                            pager: { total: found.length },
                            organisationUnits: found,
                        }
                    },
                    userLookup: async (_type, { params }) => {
                        queries.push(params?.query)
                        return {
                            users: [
                                {
                                    username: 'admin',
                                    displayName: 'John Traore',
                                },
                            ],
                        }
                    },
                }}
            >
                <ValueInput
                    field={{ valueType: 'ORGANISATION_UNIT' }}
                    settings={SETTINGS}
                    label={LABEL}
                    {...props}
                    value={value}
                    onChange={(next, problem) => {
                        onChange(next, problem)
                        setValue(next ?? undefined)
                    }}
                />
            </CustomDataProvider>
        )
    }
    await render(
        offline ? (
            <Provider
                config={{ baseUrl: '..', apiVersion: 42 }}
                offlineInterface={DISCONNECTED}
                userInfo={undefined}
                plugin={false}
                parentAlertsAdd={undefined}
                showAlertsInPlugin={false}
            >
                <Host />
            </Provider>
        ) : (
            <Host />
        )
    )
    return {
        onChange,
        queries,
        box: page.getByRole('combobox', { name: LABEL }),
    }
}

test('typing two characters searches the server; a pick is reported at once and shows its name', async () => {
    const { onChange, queries, box } = await mount()
    await userEvent.click(box)
    await userEvent.keyboard('Ng')
    await userEvent.click(page.getByRole('option', { name: /Ngelehun CHC/ }))

    expect(queries).toEqual(['Ng'])
    expect(onChange.mock.calls).toEqual([[CHC, undefined]])
    await expect.element(box).toHaveValue('Ngelehun CHC')
})

test('a stored org unit shows the name the host knows', async () => {
    const { box } = await mount({ value: CHC, valueName: 'Ngelehun CHC' })
    await expect.element(box).toHaveValue('Ngelehun CHC')
})

test('a stored org unit with no name known shows "Unknown" and its id', async () => {
    const { box } = await mount({ value: CHC })
    await expect.element(box).toHaveValue(`Unknown (${CHC})`)
})

test('emptied and left, the field reports no value; other typing is dropped on leaving', async () => {
    const { onChange, box } = await mount({
        value: CHC,
        valueName: 'Ngelehun CHC',
    })
    await userEvent.fill(box, 'Nowhere')
    await expect
        .element(page.getByText('No organisation units found'))
        .toBeVisible()
    await userEvent.tab()
    expect(onChange).not.toHaveBeenCalled()
    await expect.element(box).toHaveValue('Ngelehun CHC')

    await userEvent.clear(box)
    await userEvent.tab()
    expect(onChange.mock.calls).toEqual([[null, undefined]])
})

test('Enter on an emptied field reports no value', async () => {
    const { onChange, box } = await mount({
        value: CHC,
        valueName: 'Ngelehun CHC',
    })
    await userEvent.clear(box)
    await userEvent.keyboard('{Enter}')
    expect(onChange.mock.calls).toEqual([[null, undefined]])
})

test('Tab picks the highlighted result, as the field is left', async () => {
    const { onChange, box } = await mount()
    await userEvent.tab()
    await userEvent.keyboard('Ng')
    await expect
        .element(page.getByRole('option', { name: /Ngelehun CHC/ }))
        .toHaveAttribute('data-highlighted')
    await userEvent.keyboard('{Tab}')

    expect(onChange.mock.calls).toEqual([[CHC, undefined]])
    await expect.element(box).toHaveValue('Ngelehun CHC')
    await expect.element(box).not.toHaveFocus()
})

test('Enter picks the highlighted result', async () => {
    const { onChange, box } = await mount()
    await userEvent.tab()
    await userEvent.keyboard('Ng')
    await expect
        .element(page.getByRole('option', { name: /Ngelehun CHC/ }))
        .toHaveAttribute('data-highlighted')
    await userEvent.keyboard('{Enter}')

    expect(onChange.mock.calls).toEqual([[CHC, undefined]])
    await expect.element(box).toHaveValue('Ngelehun CHC')
})

test('Tab and Enter wait while the search for what was typed is still to answer', async () => {
    const { onChange, box } = await mount()
    await userEvent.tab()
    await userEvent.keyboard('Ng{Tab}{Enter}')
    await expect.element(box).toHaveFocus()
    await expect.element(box).toHaveValue('Ng')
    expect(onChange).not.toHaveBeenCalled()

    await expect
        .element(page.getByRole('option', { name: /Ngelehun CHC/ }))
        .toHaveAttribute('data-highlighted')
    await userEvent.keyboard('{Tab}')
    expect(onChange.mock.calls).toEqual([[CHC, undefined]])
})

test('a username field searches users and shows the name of the one picked', async () => {
    const { onChange, queries, box } = await mount({
        field: { valueType: 'USERNAME' },
    })
    await userEvent.tab()
    await userEvent.keyboard('adm')
    await expect
        .element(page.getByRole('option', { name: /John Traore/ }))
        .toHaveAttribute('data-highlighted')
    await userEvent.keyboard('{Tab}')

    expect(queries).toEqual(['adm'])
    expect(onChange.mock.calls).toEqual([['admin', undefined]])
    await expect.element(box).toHaveValue('John Traore')
})

test('offline, the field says it needs a connection and does not search', async () => {
    const { onChange, queries, box } = await mount({}, { offline: true })
    await expect
        .element(box)
        .toHaveAccessibleDescription('Connect to the internet to search')
    await userEvent.tab()
    await userEvent.keyboard('Ngelehun{Tab}')

    expect(queries).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
    await expect.element(box).toHaveValue('')
})

test('a result the mouse rests on is not picked by Tab', async () => {
    const { onChange, box } = await mount()
    await userEvent.tab()
    await userEvent.keyboard('Ng')
    const other = page.getByRole('option', { name: /Ngelehun MCHP/ })
    await userEvent.hover(other)
    await expect.element(other).toHaveAttribute('data-highlighted')
    await userEvent.keyboard('{Tab}')

    expect(onChange).not.toHaveBeenCalled()
    await expect.element(box).toHaveValue('')
})
