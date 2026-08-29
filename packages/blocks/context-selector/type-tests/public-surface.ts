import type {
    ContextControl,
    ContextControlMode,
    ContextDisplayItemProps,
    ContextEnrollmentSelectorProps,
    ContextIcon,
    ContextOption,
    ContextOptionLabelProps,
    ContextOptionSelectorProps,
    ContextOrganisationUnitSelectorProps,
    ContextPopupMode,
    ContextPopupControl,
    ContextProgramSelectorProps,
    ContextSelectorClearAction,
    ContextSelectorProps,
    ContextStageSelectorProps,
} from '../src'
import {
    ContextEnrollmentSelector,
    ContextOptionSelector,
    ContextStageSelector,
} from '../src'

export type SupportedContextSelectorTypes = [
    ContextControl,
    ContextControlMode,
    ContextDisplayItemProps,
    ContextEnrollmentSelectorProps,
    ContextIcon,
    ContextOption,
    ContextOptionLabelProps,
    ContextOptionSelectorProps,
    ContextOrganisationUnitSelectorProps,
    ContextPopupMode,
    ContextPopupControl,
    ContextProgramSelectorProps,
    ContextSelectorClearAction,
    ContextSelectorProps,
    ContextStageSelectorProps,
]

export const supportedContextSelectorComponents = [
    ContextEnrollmentSelector,
    ContextOptionSelector,
    ContextStageSelector,
] as const

const options: ContextOption[] = [{ value: 'program-a', label: 'Program A' }]

export const interactiveProgram: ContextProgramSelectorProps = {
    options,
    selectedValue: 'program-a',
    control: {
        mode: 'interactive',
        open: false,
        onOpenChange: () => undefined,
        onSelect: () => undefined,
        onClear: () => undefined,
    },
}

export const displayProgram: ContextProgramSelectorProps = {
    options,
    selectedValue: 'program-a',
    control: { mode: 'display', onClear: () => undefined },
}

export const loadingProgram: ContextProgramSelectorProps = {
    options,
    control: { mode: 'loading', loadingLabel: 'Loading programs' },
}

export const disabledOrgUnit: ContextOrganisationUnitSelectorProps = {
    value: 'Ngelehun CHC',
    control: { mode: 'disabled' },
}

export const interactiveOrgUnit: ContextOrganisationUnitSelectorProps = {
    value: 'Ngelehun CHC',
    children: null,
    control: {
        mode: 'interactive',
        open: false,
        onOpenChange: () => undefined,
        onClear: () => undefined,
    },
}

export const missingOpen: ContextProgramSelectorProps = {
    options,
    // @ts-expect-error Interactive selectors require controlled popup state.
    control: {
        mode: 'interactive',
        onOpenChange: () => undefined,
        onSelect: () => undefined,
    },
}

export const displayCannotSelect: ContextProgramSelectorProps = {
    options,
    control: {
        mode: 'display',
        // @ts-expect-error Display mode cannot emit selection intent.
        onSelect: () => undefined,
    },
}

export const orgUnitCannotSelect: ContextOrganisationUnitSelectorProps = {
    control: {
        mode: 'interactive',
        open: false,
        onOpenChange: () => undefined,
        // @ts-expect-error The injected picker owns organisation-unit selection.
        onSelect: () => undefined,
    },
}
