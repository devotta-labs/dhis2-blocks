import type { CalendarInput } from '@dhis2/ui'
import React, {
    useEffect,
    useState,
    type ComponentProps,
    type ReactNode,
} from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { SystemCalendar } from '../../api/schemas'
import type { FieldModel } from '../../model/buildFormModel'
import {
    createFormModelSource,
    EventFormFieldContext,
} from '../EventForm/EventFormContext'
import { EventFormField } from '../EventFormField'
import * as eventFormField from '../EventFormField'
import { EventFormTextProvider } from '../EventFormText'
import * as calendarInputBoundary from './CalendarInputBoundary'
import * as clearValueButton from './ClearValueButton'
import * as fieldShell from './FieldShell'
import * as textField from './TextField'
import * as longTextField from './LongTextField'
import * as numberField from './NumberField'
import * as choiceField from './ChoiceField'
import * as selectField from './SelectField'
import * as multiSelectField from './MultiSelectField'
import * as trueOnlyField from './TrueOnlyField'
import * as dateField from './DateField'
import * as dateTimeField from './DateTimeField'
import * as timeField from './TimeField'
import * as ageField from './AgeField'
import * as coordinateField from './CoordinateField'
import * as orgUnitField from './OrgUnitField'
import * as unsupportedField from './UnsupportedField'
import * as uiButton from '@/registry/dhis2/ui/button'
import * as uiCheckbox from '@/registry/dhis2/ui/checkbox'
import * as uiCombobox from '@/registry/dhis2/ui/combobox'
import * as uiField from '@/registry/dhis2/ui/field'
import * as uiInput from '@/registry/dhis2/ui/input'
import * as uiInputGroup from '@/registry/dhis2/ui/input-group'
import * as uiPopover from '@/registry/dhis2/ui/popover'
import * as uiRadioGroup from '@/registry/dhis2/ui/radio-group'
import * as uiSelect from '@/registry/dhis2/ui/select'
import * as uiTextarea from '@/registry/dhis2/ui/textarea'
import * as uiToggleGroup from '@/registry/dhis2/ui/toggle-group'

/* Shared by the field widget browser tests. Not a test itself, so it avoids the vitest globals. */

export type Commit = (id: string, value: string | undefined) => void

type Translate = (
    message: string,
    values?: Record<string, string | number | boolean | undefined>
) => string

export const baseField = (extra: Partial<FieldModel> = {}): FieldModel => ({
    id: 'f1',
    label: 'Field one',
    kind: 'text',
    disabled: false,
    required: false,
    requiredMissing: false,
    hidden: false,
    unsupported: false,
    messages: { ruleErrors: [] },
    ...extra,
})

export const modelOf = (...fields: FieldModel[]) => ({
    sections: [],
    fields: new Map(fields.map((field) => [field.id, field])),
})

export const attribution = {
    ruleId: 'rule1',
    ruleName: 'Gestational age rule',
    actionId: 'action1',
    condition: 'true',
    readsFields: [],
}

export const yesNo = [
    { value: 'true', label: 'Yes' },
    { value: 'false', label: 'No' },
]

export const manyChoices = ['a', 'b', 'c', 'd', 'e', 'f'].map((code) => ({
    value: code,
    label: `Option ${code.toUpperCase()}`,
}))

export const interpolate: Translate = (message, values) =>
    message.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
        String(values?.[key] ?? '')
    )

export interface MountOptions {
    calendar?: SystemCalendar
    readOnly?: boolean
    translate?: Translate
    orgUnitRoots?: readonly string[]
    wrap?: (children: ReactNode) => ReactNode
    /** The ids to render, when not the given fields in order. */
    ids?: string[]
}

/**
 * Renders the fields. Commits are passed to `spy` and written back into the model, as the store
 * does, so a field shows what was committed.
 */
export const mountField = async <Spy extends Commit>(
    spy: Spy,
    fields: FieldModel | FieldModel[],
    options: MountOptions = {}
) => {
    const list = Array.isArray(fields) ? fields : [fields]
    const source = createFormModelSource(modelOf(...list))
    const commit: Commit = (id, value) => {
        spy(id, value)
        const current = source.getField(id)
        if (current === undefined) {
            return
        }
        const { value: _old, ...rest } = current
        const next: FieldModel = value === undefined ? rest : { ...rest, value }
        list.splice(
            0,
            list.length,
            ...list.map((field) => (field.id === id ? next : field))
        )
        source.setModel(modelOf(...list))
    }
    const body = (
        <EventFormTextProvider translate={options.translate ?? interpolate}>
            <EventFormFieldContext.Provider
                value={{
                    source,
                    commit,
                    calendar: options.calendar ?? {
                        calendar: 'gregorian',
                        dateFormat: 'YYYY-MM-DD',
                    },
                    readOnly: options.readOnly ?? false,
                    orgUnitRoots: options.orgUnitRoots ?? [],
                }}
            >
                {(options.ids ?? list.map((field) => field.id)).map((id) => (
                    <EventFormField key={id} id={id} />
                ))}
                <button type="button" data-testid="outside">
                    Outside
                </button>
            </EventFormFieldContext.Provider>
        </EventFormTextProvider>
    )
    const screen = await render(
        options.wrap === undefined ? body : options.wrap(body)
    )
    return { screen, commit: spy, source }
}

/** Moves the focus out of the field. */
export const blur = () => userEvent.click(page.getByTestId('outside'))

export const textbox = (name = 'Field one') =>
    page.getByRole('textbox', { name, exact: true })

export const found = <T extends Element>(element: T | null): T => {
    if (element === null) {
        throw new Error('Expected the element to be rendered')
    }
    return element
}

/**
 * Stands in for @dhis2/ui's CalendarInput, which cannot resolve Ethiopian eras in the browser's
 * Temporal polyfill. It reports dates the way the real one does: as text in the calendar it was
 * given.
 */
export const StubCalendarInput = (
    props: ComponentProps<typeof CalendarInput>
) => {
    const [text, setText] = useState(props.date ?? '')
    useEffect(() => setText(props.date ?? ''), [props.date])
    const select = (calendarDateString: string | null) =>
        // SAFETY: DHIS2 CalendarInput emits this documented runtime payload.
        props.onDateSelect({
            calendarDateString,
            validation: { valid: true },
        } as Parameters<typeof props.onDateSelect>[0])
    return (
        <div>
            <input
                type="text"
                id={props.name}
                value={text}
                disabled={props.disabled}
                onChange={(event) => setText(event.target.value)}
                onBlur={() => select(text === '' ? null : text)}
            />
            <span data-testid="stub-calendar">{props.calendar}</span>
            <button type="button" onClick={() => select('2018-07-04')}>
                Pick 2018-07-04
            </button>
        </div>
    )
}

interface FiberLike {
    type?: object | null
    elementType?: object | null
    return: FiberLike | null
}

const fiberOf = (element: Element): FiberLike | undefined => {
    const entry = Object.entries(element).find(([name]) =>
        name.startsWith('__reactFiber$')
    )
    // SAFETY: React stores the element's fiber under the `__reactFiber$…` key.
    return entry?.[1] as FiberLike | undefined
}

/** Every component this block and its primitives export, whatever way React wraps it. */
const OWN_COMPONENTS = new Set<unknown>(
    [
        eventFormField,
        fieldShell,
        calendarInputBoundary,
        clearValueButton,
        textField,
        longTextField,
        numberField,
        choiceField,
        selectField,
        multiSelectField,
        trueOnlyField,
        dateField,
        dateTimeField,
        timeField,
        ageField,
        coordinateField,
        orgUnitField,
        unsupportedField,
        uiButton,
        uiCheckbox,
        uiCombobox,
        uiField,
        uiInput,
        uiInputGroup,
        uiPopover,
        uiRadioGroup,
        uiSelect,
        uiTextarea,
        uiToggleGroup,
    ].flatMap((module) => Object.values(module))
)

/** Own components from `EventFormField` down to the element, both ends included. */
export const depthTo = (element: Element): number => {
    let depth = 0
    let fiber = fiberOf(element)
    while (fiber) {
        if (
            OWN_COMPONENTS.has(fiber.type) ||
            OWN_COMPONENTS.has(fiber.elementType)
        ) {
            depth += 1
        }
        if (
            fiber.elementType === EventFormField ||
            fiber.type === EventFormField
        ) {
            return depth
        }
        fiber = fiber.return ?? undefined
    }
    throw new Error('EventFormField is not an ancestor of the element')
}
