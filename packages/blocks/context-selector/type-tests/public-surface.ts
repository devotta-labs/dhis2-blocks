import type {
    ContextSelectorProps,
    ContextValueProps,
    EnrollmentSelectorProps,
    EventSelectorProps,
    Option,
    OptionIcon,
    OptionSelectorProps,
    OrganisationUnitSelectorProps,
    ProgramSelectorProps,
    SelectorProps,
    StageSelectorProps,
} from '../src'
import {
    ContextSelector,
    ContextValue,
    EnrollmentSelector,
    EventSelector,
    OptionSelector,
    OrganisationUnitSelector,
    ProgramSelector,
    StageSelector,
} from '../src'

export type SupportedContextSelectorTypes = [
    ContextSelectorProps,
    ContextValueProps,
    EnrollmentSelectorProps,
    EventSelectorProps,
    Option,
    OptionIcon,
    OptionSelectorProps,
    OrganisationUnitSelectorProps,
    ProgramSelectorProps,
    SelectorProps,
    StageSelectorProps,
]

export const supportedContextSelectorComponents = [
    ContextSelector,
    ProgramSelector,
    OrganisationUnitSelector,
    EnrollmentSelector,
    StageSelector,
    EventSelector,
    OptionSelector,
    ContextValue,
] as const

const options: Option[] = [
    {
        value: 'program-a',
        label: 'Program A',
        excludeFromMenu: false,
    },
]

export const interactiveProgram: ProgramSelectorProps = {
    options,
    value: 'program-a',
    open: false,
    onOpenChange: () => undefined,
    onChange: () => undefined,
    onClear: () => undefined,
}

export const readOnlyProgram: ProgramSelectorProps = {
    options,
    value: 'program-a',
    readOnly: true,
    onClear: () => undefined,
}

export const loadingProgram: ProgramSelectorProps = {
    options,
    loading: true,
    loadingLabel: 'Loading programs',
}

export const disabledOrgUnit: OrganisationUnitSelectorProps = {
    value: 'Ngelehun CHC',
    disabled: true,
}

export const interactiveOrgUnit: OrganisationUnitSelectorProps = {
    value: 'Ngelehun CHC',
    children: null,
    open: false,
    onOpenChange: () => undefined,
    onClear: () => undefined,
}

export const interactiveEvent: EventSelectorProps = {
    label: 'Visit date',
    options,
    value: 'program-a',
    open: false,
    onOpenChange: () => undefined,
    onChange: () => undefined,
}

// @ts-expect-error Event labels are metadata-derived and therefore host-owned.
export const eventWithoutLabel: EventSelectorProps = { options }

// @ts-expect-error Generic option selectors require a host-owned label.
export const optionWithoutLabel: OptionSelectorProps = { options }
