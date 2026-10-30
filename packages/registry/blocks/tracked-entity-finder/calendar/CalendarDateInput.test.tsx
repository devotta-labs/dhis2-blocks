import React, { useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { FinderSystemInfo } from '../api/systemInfo'
import {
    CalendarDateInput,
    CalendarInputProvider,
    type StrictCalendarInputProps,
} from './CalendarDateInput'

const ethiopian: FinderSystemInfo = {
    calendar: 'ethiopian',
    dateFormat: 'YYYY-MM-DD',
}
const gregorianDayFirst: FinderSystemInfo = {
    calendar: 'gregorian',
    dateFormat: 'DD-MM-YYYY',
}

/** Holds the value like a field would and records every change. */
const Harness = ({
    info,
    initial = '',
    onChange,
}: {
    info: FinderSystemInfo
    initial?: string
    onChange: (next: string) => void
}) => {
    const [value, setValue] = useState(initial)
    return (
        <CalendarDateInput
            label="Date of birth"
            value={value}
            info={info}
            onChange={(next) => {
                onChange(next)
                setValue(next)
            }}
        />
    )
}

const ThrowingCalendarInput = (): React.ReactElement => {
    throw new Error('CalendarInput failed to render')
}

let reported: StrictCalendarInputProps | undefined
const ReportingCalendarInput = (props: StrictCalendarInputProps) => {
    reported = props
    return <input aria-label={props.label} defaultValue={props.date} />
}

const dateField = () => page.getByLabelText('Date of birth')

const typeDate = async (text: string) => {
    await userEvent.fill(dateField(), text)
    // CalendarInput reports a typed date when the input loses focus.
    await userEvent.tab()
}

describe('CalendarDateInput', () => {
    it('does not crash on the ethiopian calendar', async () => {
        const onChange = vi.fn()
        await render(<Harness info={ethiopian} onChange={onChange} />)

        await typeDate('2017-01-01')

        await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('2024-09-11')
        await expect.element(dateField()).toHaveValue('2017-01-01')
    })

    it('shows an ISO value on the system calendar in the system format', async () => {
        await render(
            <Harness
                info={gregorianDayFirst}
                initial="2024-05-23"
                onChange={vi.fn()}
            />
        )
        await expect.element(dateField()).toHaveValue('23-05-2024')
    })

    it('reports a typed date in the system format as ISO', async () => {
        const onChange = vi.fn()
        await render(<Harness info={gregorianDayFirst} onChange={onChange} />)

        await typeDate('23-05-2024')

        await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('2024-05-23')
    })

    it('passes the calendar and format to CalendarInput', async () => {
        await render(
            <CalendarInputProvider component={ReportingCalendarInput}>
                <Harness
                    info={{ calendar: 'ethiopian', dateFormat: 'DD-MM-YYYY' }}
                    initial="2024-09-11"
                    onChange={vi.fn()}
                />
            </CalendarInputProvider>
        )
        await expect.element(dateField()).toHaveValue('01-01-2017')
        expect(reported).toMatchObject({
            calendar: 'ethiopic',
            format: 'DD-MM-YYYY',
            date: '01-01-2017',
            strictValidation: true,
        })
    })

    it('reports a cleared date as empty', async () => {
        const onChange = vi.fn()
        await render(
            <Harness
                info={gregorianDayFirst}
                initial="2024-05-23"
                onChange={onChange}
            />
        )

        // CalendarInput reports an emptied input as a null date.
        await typeDate('')

        await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('')
    })

    describe('when CalendarInput throws', () => {
        const renderFallback = (
            onChange: (next: string) => void,
            initial = ''
        ) =>
            render(
                <CalendarInputProvider component={ThrowingCalendarInput}>
                    <Harness
                        info={ethiopian}
                        initial={initial}
                        onChange={onChange}
                    />
                </CalendarInputProvider>
            )

        it('falls back to a labelled text input in the system format', async () => {
            await renderFallback(vi.fn(), '2024-09-11')
            await expect.element(dateField()).toHaveValue('2017-01-01')
            await expect
                .element(dateField())
                .toHaveAttribute('placeholder', 'YYYY-MM-DD')
        })

        it('reports a typed date as ISO', async () => {
            const onChange = vi.fn()
            await renderFallback(onChange)
            await userEvent.fill(dateField(), '2016-13-01')
            expect(onChange).toHaveBeenLastCalledWith('2024-09-06')
            await expect.element(dateField()).toHaveValue('2016-13-01')
        })

        it('reports text that is not a date as typed', async () => {
            const onChange = vi.fn()
            await renderFallback(onChange)
            await userEvent.fill(dateField(), '2016-13')
            expect(onChange).toHaveBeenLastCalledWith('2016-13')
            await expect.element(dateField()).toHaveValue('2016-13')
        })

        it('never reports an invalid local date as a valid ISO date', async () => {
            const onChange = vi.fn()
            await renderFallback(onChange)
            // Not a day on the Ethiopian calendar, but a real ISO date.
            await userEvent.fill(dateField(), '2017-01-31')
            const next: string = onChange.mock.lastCall?.[0]
            expect(next).not.toMatch(/^\d{4}-\d{2}-\d{2}$/)
            await expect.element(dateField()).toHaveValue('2017-01-31')
        })
    })
})
