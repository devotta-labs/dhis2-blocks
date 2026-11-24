import React from 'react'
import { render } from 'vitest-browser-react'
import { VisitDate, VisitViewer } from '..'

const timeOf = (container: HTMLElement) => {
    const time = container.querySelector('time')
    if (time === null) {
        throw new Error('No <time> rendered')
    }
    return time
}

describe('visit date', () => {
    it('formats a stored day in Gregorian outside a viewer', async () => {
        const { container } = await render(
            <VisitDate value="2026-11-12" locale="en-GB" />
        )
        const time = timeOf(container)
        expect(time.dateTime).toBe('2026-11-12')
        expect(time).toHaveTextContent('12 Nov 2026')
        expect(time.getAttribute('data-slot')).toBe('visit-date')
    })

    it('keeps the stored day of a date-time, whatever the time zone', async () => {
        const { container } = await render(
            <VisitDate value="2026-11-12T23:30:00.000" locale="en-GB" />
        )
        expect(timeOf(container)).toHaveTextContent('12 Nov 2026')
        expect(timeOf(container).dateTime).toBe('2026-11-12')
    })

    it('adds the stored time and a prefix when asked', async () => {
        const { container } = await render(
            <VisitDate
                value="2026-11-12T14:30:00.000"
                locale="en-GB"
                showTime
                prefix="Due"
            />
        )
        const time = timeOf(container)
        expect(time.dateTime).toBe('2026-11-12T14:30')
        expect(time).toHaveTextContent('Due 12 Nov 2026 14:30')
    })

    it('leaves the time out of a stored day even when asked for it', async () => {
        const { container } = await render(
            <VisitDate value="2026-11-12" locale="en-GB" showTime />
        )
        expect(timeOf(container)).toHaveTextContent(/^12 Nov 2026$/)
    })

    it('formats in the viewer’s calendar, including Ethiopian', async () => {
        const { container } = await render(
            <VisitViewer calendar="ethiopian">
                <VisitDate value="2026-10-14" />
            </VisitViewer>
        )
        const time = timeOf(container)
        expect(time).toHaveTextContent('2019-02-04')
        expect(time.dateTime).toBe('2026-10-14')
    })

    it('uses the viewer’s locale and lets a date override the calendar', async () => {
        const { container } = await render(
            <VisitViewer calendar="nepali" locale="en-US">
                <VisitDate value="2026-10-18" data-testid="nepali" />
                <VisitDate
                    value="2026-10-18"
                    calendar="gregorian"
                    data-testid="gregorian"
                />
            </VisitViewer>
        )
        const [nepali, gregorian] = container.querySelectorAll('time')
        expect(nepali).toHaveTextContent('2083-07-01')
        expect(gregorian).toHaveTextContent('Oct 18, 2026')
    })

    it('shows an unreadable value as it is', async () => {
        const { container } = await render(<VisitDate value="soon" />)
        const time = timeOf(container)
        expect(time).toHaveTextContent('soon')
        expect(time.hasAttribute('datetime')).toBe(false)
    })
})
