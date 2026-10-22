import type {
    ClearSelectionsProps,
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
} from '..'
import {
    ClearSelections,
    ContextSelector,
    ContextValue,
    EnrollmentSelector,
    EventSelector,
    OptionSelector,
    OrganisationUnitSelector,
    ProgramSelector,
    StageSelector,
} from '..'

export type SupportedContextSelectorTypes = [
    ClearSelectionsProps,
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
    ClearSelections,
    ProgramSelector,
    OrganisationUnitSelector,
    EnrollmentSelector,
    StageSelector,
    EventSelector,
    OptionSelector,
    ContextValue,
] as const

export const clearSelections: ClearSelectionsProps = {
    onClear: () => undefined,
    disabled: false,
}

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

type IsRequired<T, K extends keyof T> =
    Record<never, never> extends Pick<T, K> ? false : true

export const requiredLabelContracts: [
    IsRequired<EventSelectorProps, 'label'>,
    IsRequired<OptionSelectorProps, 'label'>,
] = [true, true]
