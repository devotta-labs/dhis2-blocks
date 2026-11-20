import React, { type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import {
    Calendar,
    CalendarDayRecords,
    CalendarGrid,
    CalendarNavigation,
    useCalendar,
} from '..'

const CustomPanel = ({ visible = true }: { visible?: boolean }) => {
    const {
        state: { selectedDay },
    } = useCalendar()
    return visible ? (
        <aside data-calendar-panel="">Selected: {selectedDay?.date}</aside>
    ) : null
}

const Composition = ({
    width,
    children,
}: {
    width: number
    children?: ReactNode
}) => (
    <Calendar style={{ width }} defaultSelectedDay="2026-11-14">
        <CalendarNavigation />
        <CalendarGrid />
        {children}
        <footer data-testid="custom-main">Custom main content</footer>
    </Calendar>
)

const element = (container: HTMLElement, selector: string) => {
    const found = container.querySelector<HTMLElement>(selector)
    if (!found) throw new Error(`Missing ${selector}`)
    return found
}

const rect = (container: HTMLElement, slot: string) =>
    element(container, `[data-slot="${slot}"]`).getBoundingClientRect()

describe('calendar composition layout', () => {
    it.each([640, 960])('fills %ipx without a side panel', async (width) => {
        const { container } = await render(<Composition width={width} />)

        await expect
            .poll(() => rect(container, 'calendar-grid').width)
            .toBeCloseTo(width)
        expect(rect(container, 'calendar-grid').left).toBe(
            rect(container, 'calendar').left
        )
        expect(
            element(
                container,
                '[data-testid="custom-main"]'
            ).getBoundingClientRect().width
        ).toBeCloseTo(width)
    })

    it.each(['built-in', 'custom'])(
        'places a %s panel beside main content at wide widths',
        async (kind) => {
            const { container } = await render(
                <Composition width={960}>
                    {kind === 'built-in' ? (
                        <CalendarDayRecords />
                    ) : (
                        <CustomPanel />
                    )}
                </Composition>
            )

            await expect
                .poll(() => rect(container, 'calendar-grid').width)
                .toBeCloseTo(660)
            const panel = element(
                container,
                '[data-calendar-panel]'
            ).getBoundingClientRect()
            expect(panel.width).toBeCloseTo(288)
            expect(
                panel.left - rect(container, 'calendar-grid').right
            ).toBeCloseTo(12)
            expect(
                getComputedStyle(element(container, '[data-calendar-panel]'))
                    .gridRowStart
            ).toBe('1')
            expect(panel.top).toBeLessThan(rect(container, 'calendar-grid').top)
            expect(
                element(
                    container,
                    '[data-testid="custom-main"]'
                ).getBoundingClientRect().left
            ).toBe(rect(container, 'calendar').left)
        }
    )

    it.each(['built-in', 'custom'])(
        'stacks a %s panel below a full-width narrow grid',
        async (kind) => {
            const { container } = await render(
                <Composition width={640}>
                    {kind === 'built-in' ? (
                        <CalendarDayRecords />
                    ) : (
                        <CustomPanel />
                    )}
                </Composition>
            )

            await expect
                .poll(() => rect(container, 'calendar-grid').width)
                .toBeCloseTo(640)
            const panel = element(
                container,
                '[data-calendar-panel]'
            ).getBoundingClientRect()
            expect(panel.width).toBeCloseTo(640)
            expect(panel.left).toBe(rect(container, 'calendar-grid').left)
            expect(panel.top).toBeGreaterThan(
                rect(container, 'calendar-grid').bottom
            )
        }
    )

    it.each(['built-in', 'custom'])(
        'adapts when a %s panel mounts or returns null, preserving selection',
        async (kind) => {
            const composition = (visible: boolean) => (
                <Composition width={960}>
                    {kind === 'built-in' ? (
                        visible && <CalendarDayRecords />
                    ) : (
                        <CustomPanel visible={visible} />
                    )}
                </Composition>
            )
            const screen = await render(composition(true))
            const { container } = screen
            await screen
                .getByRole('button', {
                    name: '15 November 2026, no records',
                    exact: true,
                })
                .click()

            await screen.rerender(composition(false))
            await expect
                .poll(() => rect(container, 'calendar-grid').width)
                .toBeCloseTo(960)
            expect(container.querySelector('[data-calendar-panel]')).toBeNull()

            await screen.rerender(composition(true))
            await expect
                .poll(() => rect(container, 'calendar-grid').width)
                .toBeCloseTo(660)
            await expect
                .element(
                    kind === 'built-in'
                        ? screen.getByRole('heading', {
                              name: '15 November 2026',
                          })
                        : screen.getByText('Selected: 2026-11-15', {
                              exact: true,
                          })
                )
                .toBeVisible()
        }
    )

    it('ignores nested markers and does not create implicit columns for a wrapped panel', async () => {
        const { container } = await render(
            <Composition width={960}>
                <div data-testid="wrapper">
                    <CalendarDayRecords />
                </div>
            </Composition>
        )

        await expect
            .poll(() => rect(container, 'calendar-grid').width)
            .toBeCloseTo(960)
        expect(rect(container, 'calendar-day-records').width).toBeCloseTo(960)
        expect(
            getComputedStyle(element(container, '[data-testid="wrapper"]'))
                .gridColumnStart
        ).toBe('1')
        expect(
            getComputedStyle(
                element(container, '[data-slot="calendar-day-records"]')
            ).gridColumnStart
        ).toBe('auto')
    })

    it('switches at the container breakpoint, not the viewport width', async () => {
        const screen = await render(
            <Composition width={767}>
                <CustomPanel />
            </Composition>
        )
        await expect
            .poll(() => rect(screen.container, 'calendar-grid').width)
            .toBeCloseTo(767)

        await screen.rerender(
            <Composition width={768}>
                <CustomPanel />
            </Composition>
        )
        await expect
            .poll(() => rect(screen.container, 'calendar-grid').width)
            .toBeCloseTo(468)
    })
})
