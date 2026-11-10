import { CustomDataProvider } from '@dhis2/app-runtime'
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

/** An org unit field in a form that keeps the value it is told, over a server whose org units start "Ngelehun". */
const mount = async (props: Partial<ValueInputProps> = {}) => {
    const onChange = vi.fn()
    const queries: unknown[] = []
    const Host = () => {
        const [value, setValue] = useState(props.value)
        return (
            <CustomDataProvider
                data={{
                    organisationUnits: async (_type, { params }) => {
                        queries.push(params?.query)
                        return {
                            pager: { total: 2 },
                            organisationUnits: [
                                orgUnit(CHC, 'Ngelehun CHC'),
                                orgUnit('FwKJ7gYEv8U', 'Ngelehun MCHP'),
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
    await render(<Host />)
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
