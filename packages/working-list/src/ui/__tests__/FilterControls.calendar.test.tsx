import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { resolveWorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import { TrackerProgramSchema } from '../../api/schemas'
import type { AppliedFilter, WorkingListField } from '../../domain/model'
import {
    FilterButton,
    FilterControlsComponentProvider,
    MoreFilters,
    ProgramStageControl,
    calendarInputDateToCanonical,
    canonicalDateToCalendarInput,
    type StrictCalendarInputProps,
} from '../FilterControls'
import { WorkingListTextProvider } from '../WorkingListText'

const TestCalendarInput = (props: StrictCalendarInputProps) =>
    React.createElement(
        'button',
        {
            type: 'button',
            'data-test': props.dataTest,
            'data-calendar': props.calendar,
            'data-date': props.date,
            'data-error': String(Boolean(props.error)),
            'data-format': props.format,
            'data-time-zone': props.timeZone,
            onClick: () =>
                props.onDateSelect({
                    calendarDateString: '31-12-2017',
                    validation: {
                        valid: true,
                        error: false,
                        warning: false,
                    },
                }),
            onDoubleClick: () =>
                props.onDateSelect({
                    calendarDateString: '32-13-2017',
                    validation: {
                        valid: false,
                        error: true,
                        validationText: 'Invalid date',
                    },
                }),
        },
        props.validationText ?? props.dataTest
    )

const TestPopover = ({
    arrow,
    children,
}: {
    arrow?: boolean
    children: React.ReactNode
}) =>
    React.createElement(
        'div',
        { 'data-testid': 'mock-popover', 'data-arrow': String(arrow) },
        children
    )

const testComponents = {
    CalendarInput: TestCalendarInput,
    Popover: TestPopover,
}

const unusedClient: WorkingListClient = {
    query: () => Promise.reject(new Error('Unexpected query in calendar test')),
    mutate: () =>
        Promise.reject(new Error('Unexpected mutation in calendar test')),
}

const field: WorkingListField = {
    id: 'birthday',
    displayName: 'Birthday',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'DATE',
    filterable: true,
}

describe('calendar filter controls', () => {
    it.each([
        ['2026-08-18', 'YYYY-MM-DD', '2026-08-18'],
        ['2026-08-18', 'DD-MM-YYYY', '18-08-2026'],
        ['2026-02-31', 'DD-MM-YYYY', '31-02-2026'],
        [undefined, 'DD-MM-YYYY', undefined],
    ] as const)(
        'adapts canonical %s to %s as %s',
        (canonical, format, expected) => {
            expect(canonicalDateToCalendarInput(canonical, format)).toBe(
                expected
            )
            expect(calendarInputDateToCanonical(expected, format)).toBe(
                canonical
            )
        }
    )

    it('normalises a calendar draft and applies it only after Update', () => {
        const actEnvironment = globalThis
        const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        const originalRequestAnimationFrame = window.requestAnimationFrame
        const originalCancelAnimationFrame = window.cancelAnimationFrame
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
        window.requestAnimationFrame = (callback) => {
            callback(0)
            return 1
        }
        window.cancelAnimationFrame = () => undefined

        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        const onApply = jest.fn<void, [AppliedFilter]>()

        try {
            act(() => {
                root.render(
                    <WorkingListTextProvider translate={(message) => message}>
                        <FilterControlsComponentProvider
                            components={testComponents}
                        >
                            <FilterButton
                                client={unusedClient}
                                field={field}
                                filter={{
                                    field,
                                    operator: 'range',
                                    value: {
                                        kind: 'dateRange',
                                        mode: 'absolute',
                                        start: '2017-01-02',
                                    },
                                }}
                                capabilities={resolveWorkingListCapabilities({
                                    apiVersion: 42,
                                })}
                                validationContext={{
                                    validateDate: (value) => {
                                        if (value === '2017-13-32') {
                                            throw new Error('Invalid date')
                                        }
                                    },
                                }}
                                calendarContext={{
                                    calendar: 'ethiopian',
                                    dateFormat: 'DD-MM-YYYY',
                                    locale: 'am-ET',
                                    timeZone: 'Africa/Addis_Ababa',
                                }}
                                onApply={onApply}
                                onReset={jest.fn()}
                            />
                        </FilterControlsComponentProvider>
                    </WorkingListTextProvider>
                )
            })

            const trigger = container.querySelector<HTMLButtonElement>(
                '[data-testid="filter-birthday"]'
            )
            act(() => trigger?.click())

            const startInput = document.querySelector<HTMLButtonElement>(
                '[data-test="date-range-start"]'
            )
            expect(startInput?.dataset.calendar).toBe('ethiopic')
            expect(startInput?.dataset.format).toBe('DD-MM-YYYY')
            expect(startInput?.dataset.date).toBe('02-01-2017')
            expect(startInput?.dataset.timeZone).toBeUndefined()

            const startClear = document.querySelector<HTMLButtonElement>(
                '[data-test="date-range-start-clear"]'
            )
            expect(startClear?.getAttribute('aria-label')).toBe('Clear')
            expect(
                document.querySelector('[data-test="date-range-end-clear"]')
            ).toBeNull()
            act(() => startClear?.click())
            expect(
                document.querySelector<HTMLButtonElement>(
                    '[data-test="date-range-start"]'
                )?.dataset.date
            ).toBeUndefined()
            expect(
                document.querySelector('[data-test="date-range-start-clear"]')
            ).toBeNull()

            expect(
                document
                    .querySelector('[data-testid="mock-popover"]')
                    ?.getAttribute('data-arrow')
            ).toBe('false')
            const update = document.querySelector<HTMLButtonElement>(
                '[data-test="filter-update-birthday"]'
            )

            act(() =>
                startInput?.dispatchEvent(
                    new MouseEvent('dblclick', { bubbles: true })
                )
            )
            expect(startInput?.dataset.error).toBe('true')
            expect(startInput?.textContent).toBe('Invalid date')
            expect(onApply).not.toHaveBeenCalled()
            act(() => update?.click())
            expect(onApply).not.toHaveBeenCalled()
            expect(document.querySelector('[role="alert"]')).not.toBeNull()

            act(() => startInput?.click())
            expect(startInput?.dataset.error).toBe('false')
            expect(onApply).not.toHaveBeenCalled()

            act(() => update?.click())

            expect(onApply).toHaveBeenCalledWith(
                expect.objectContaining({
                    value: expect.objectContaining({
                        kind: 'dateRange',
                        mode: 'absolute',
                        start: '2017-12-31',
                    }),
                })
            )
        } finally {
            act(() => root.unmount())
            container.remove()
            window.requestAnimationFrame = originalRequestAnimationFrame
            window.cancelAnimationFrame = originalCancelAnimationFrame
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })

    it('disables arrows on filter menus and program-stage popovers', () => {
        const actEnvironment = globalThis
        const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        const originalRequestAnimationFrame = window.requestAnimationFrame
        const originalCancelAnimationFrame = window.cancelAnimationFrame
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
        window.requestAnimationFrame = (callback) => {
            callback(0)
            return 1
        }
        window.cancelAnimationFrame = () => undefined

        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)

        try {
            act(() => {
                root.render(
                    <WorkingListTextProvider translate={(message) => message}>
                        <FilterControlsComponentProvider
                            components={testComponents}
                        >
                            <MoreFilters
                                fields={[field]}
                                visibleFilterIds={[]}
                                scope="tracked-entity"
                                onAdd={jest.fn()}
                            />
                            <ProgramStageControl
                                program={TrackerProgramSchema.parse({
                                    id: 'program',
                                    displayName: 'Program',
                                    programType: 'WITH_REGISTRATION',
                                    programTrackedEntityAttributes: [],
                                    programStages: [
                                        {
                                            id: 'stage',
                                            displayName: 'Stage',
                                            access: { read: true },
                                            programStageDataElements: [],
                                        },
                                    ],
                                })}
                                onChange={jest.fn()}
                                onRemove={jest.fn()}
                            />
                        </FilterControlsComponentProvider>
                    </WorkingListTextProvider>
                )
            })

            act(() =>
                container
                    .querySelector<HTMLButtonElement>(
                        '[data-testid="more-filters-tracked-entity"]'
                    )
                    ?.click()
            )
            act(() =>
                container
                    .querySelector<HTMLButtonElement>(
                        '[data-testid="filter-programStage"]'
                    )
                    ?.click()
            )

            const popovers = [
                ...document.querySelectorAll('[data-testid="mock-popover"]'),
            ]
            expect(popovers).toHaveLength(2)
            expect(
                popovers.every(
                    (popover) => popover.getAttribute('data-arrow') === 'false'
                )
            ).toBe(true)
        } finally {
            act(() => root.unmount())
            container.remove()
            window.requestAnimationFrame = originalRequestAnimationFrame
            window.cancelAnimationFrame = originalCancelAnimationFrame
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })
})
