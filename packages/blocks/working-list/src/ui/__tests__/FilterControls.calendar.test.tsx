import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { resolveWorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import { TrackerProgramSchema } from '../../api/schemas'
import type { AppliedFilter, WorkingListField } from '../../domain/model'
import {
    FilterButton,
    FilterControlsComponentProvider,
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
                // SAFETY: DHIS2 CalendarInput emits this documented runtime validation payload.
                props.onDateSelect({
                    calendarDateString: '31-12-2017',
                    validation: {
                        valid: true,
                        error: false,
                        warning: false,
                    },
                } as Parameters<typeof props.onDateSelect>[0]),
            onDoubleClick: () =>
                // SAFETY: DHIS2 CalendarInput emits this documented runtime validation payload.
                props.onDateSelect({
                    calendarDateString: '32-13-2017',
                    validation: {
                        valid: false,
                        error: true,
                        validationText: 'Invalid date',
                    },
                } as Parameters<typeof props.onDateSelect>[0]),
        },
        props.validationText ?? props.dataTest
    )

// The filter editors open below-start of their chip with no arrow, as the
// @dhis2/ui Popover they replaced did with `arrow={false}`.
const expectEditorPopover = (editorTestId: string) => {
    const popups = [
        ...document.querySelectorAll('[data-slot="popover-content"]'),
    ]
    expect(popups).toHaveLength(1)
    const [popup] = popups
    expect(
        popup?.querySelector(`[data-testid="${editorTestId}"]`)
    ).not.toBeNull()
    expect(popup?.getAttribute('data-side')).toBe('bottom')
    expect(popup?.getAttribute('data-align')).toBe('start')
    expect(popup?.querySelector('[data-slot="popover-arrow"]')).toBeNull()
}

const testComponents = {
    CalendarInput: TestCalendarInput,
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
        const onApply = vi.fn<(filter: AppliedFilter) => void>()

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
                                onReset={vi.fn()}
                            />
                        </FilterControlsComponentProvider>
                    </WorkingListTextProvider>
                )
            })

            const trigger = container.querySelector<HTMLButtonElement>(
                '[data-testid="filter-birthday"] [role="combobox"]'
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

            expectEditorPopover('filter-editor-birthday')
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

    it('opens the program-stage editor below its chip without an arrow', () => {
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
                                onChange={vi.fn()}
                                onRemove={vi.fn()}
                            />
                        </FilterControlsComponentProvider>
                    </WorkingListTextProvider>
                )
            })

            act(() =>
                container
                    .querySelector<HTMLButtonElement>(
                        '[data-testid="filter-programStage"] [role="combobox"]'
                    )
                    ?.click()
            )

            expectEditorPopover('filter-editor-programStage')
        } finally {
            act(() => root.unmount())
            container.remove()
            window.requestAnimationFrame = originalRequestAnimationFrame
            window.cancelAnimationFrame = originalCancelAnimationFrame
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })

    it('shows minimum-character guidance only for positive limits', () => {
        const actEnvironment = globalThis
        const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        const renderFilter = (minCharactersToSearch: number) => {
            act(() => {
                root.render(
                    <WorkingListTextProvider translate={(message) => message}>
                        <FilterControlsComponentProvider
                            components={testComponents}
                        >
                            <FilterButton
                                defaultOpen
                                client={unusedClient}
                                field={{
                                    id: 'name',
                                    displayName: 'Name',
                                    source: 'trackedEntityAttribute',
                                    scope: 'trackedEntity',
                                    valueType: 'TEXT',
                                    filterable: true,
                                    minCharactersToSearch,
                                }}
                                capabilities={resolveWorkingListCapabilities({
                                    apiVersion: 43,
                                })}
                                calendarContext={{
                                    calendar: 'gregorian',
                                    dateFormat: 'YYYY-MM-DD',
                                    locale: 'en',
                                    timeZone: 'Etc/UTC',
                                }}
                                onApply={vi.fn()}
                                onReset={vi.fn()}
                            />
                        </FilterControlsComponentProvider>
                    </WorkingListTextProvider>
                )
            })
        }

        try {
            renderFilter(0)
            expect(document.body.textContent).not.toContain(
                'Enter at least 0 characters'
            )
            expect(
                document
                    .querySelector<HTMLInputElement>(
                        '[data-testid="filter-editor-name"] label input'
                    )
                    ?.getAttribute('minlength')
            ).toBeNull()

            renderFilter(3)
            expect(document.body.textContent).toContain(
                'Enter at least {{count}} characters'
            )
            expect(
                document
                    .querySelector<HTMLInputElement>(
                        '[data-testid="filter-editor-name"] label input'
                    )
                    ?.getAttribute('minlength')
            ).toBe('3')
        } finally {
            act(() => root.unmount())
            container.remove()
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })

    it('uses the Capture yes-only checkbox interaction', () => {
        const actEnvironment = globalThis
        const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        const onApply = vi.fn<(filter: AppliedFilter) => void>()

        try {
            act(() => {
                root.render(
                    <WorkingListTextProvider translate={(message) => message}>
                        <FilterControlsComponentProvider
                            components={testComponents}
                        >
                            <FilterButton
                                defaultOpen
                                client={unusedClient}
                                field={{
                                    id: 'startedOnArt',
                                    displayName: 'Started on ART?',
                                    source: 'eventDataElement',
                                    scope: 'event',
                                    valueType: 'TRUE_ONLY',
                                    filterable: true,
                                }}
                                capabilities={resolveWorkingListCapabilities({
                                    apiVersion: 43,
                                })}
                                calendarContext={{
                                    calendar: 'gregorian',
                                    dateFormat: 'YYYY-MM-DD',
                                    locale: 'en',
                                    timeZone: 'Etc/UTC',
                                }}
                                onApply={onApply}
                                onReset={vi.fn()}
                            />
                        </FilterControlsComponentProvider>
                    </WorkingListTextProvider>
                )
            })

            expect(
                document.querySelector(
                    '[data-test="filter-operator-startedOnArt"]'
                )
            ).toBeNull()
            expect(document.body.textContent).not.toContain(
                'Only records with a true value will match.'
            )
            expect(document.body.textContent).toContain('Is empty')
            expect(document.body.textContent).toContain('Is not empty')
            expect(document.body.textContent).toContain('Yes')
            expect(
                document.querySelector('[data-test="true-only-divider"]')
            ).not.toBeNull()

            const update = document.querySelector<HTMLButtonElement>(
                '[data-test="filter-update-startedOnArt"]'
            )
            expect(update?.disabled).toBe(true)

            const yes = document.querySelector<HTMLInputElement>(
                '[data-test="true-only-yes-startedOnArt"] input'
            )
            act(() => yes?.click())
            expect(yes?.checked).toBe(true)
            expect(update?.disabled).toBe(false)

            act(() => update?.click())
            expect(onApply).toHaveBeenCalledWith(
                expect.objectContaining({
                    operator: 'equals',
                    value: { kind: 'trueOnly', value: true },
                })
            )
        } finally {
            act(() => root.unmount())
            container.remove()
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })
})
