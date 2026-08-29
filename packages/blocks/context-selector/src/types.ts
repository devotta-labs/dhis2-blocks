/** Host-resolved icon data. The block deliberately does not depend on app-runtime. */
export interface ContextIcon {
    source?: string
    color?: string
    alternativeText?: string
}

export interface ContextOption {
    value: string
    label: string
    icon?: ContextIcon
    disabled?: boolean
}

interface ContextInteractiveControl {
    mode: 'interactive'
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelect: (value: string) => void
    onClear?: () => void
}

interface ContextDisplayControl {
    mode: 'display'
    onClear?: () => void
}

interface ContextLoadingControl {
    mode: 'loading'
    loadingLabel?: string
    onClear?: never
}

interface ContextDisabledControl {
    mode: 'disabled'
    onClear?: never
}

export type ContextControlMode =
    | ContextInteractiveControl
    | ContextDisplayControl
    | ContextLoadingControl
    | ContextDisabledControl

/** Concise public alias for the option-selector control contract. */
export type ContextControl = ContextControlMode

interface ContextInteractivePopup {
    mode: 'interactive'
    open: boolean
    onOpenChange: (open: boolean) => void
    onClear?: () => void
}

export type ContextPopupMode =
    | ContextInteractivePopup
    | ContextDisplayControl
    | ContextLoadingControl
    | ContextDisabledControl

/** Concise public alias for host-owned popup controls such as OU pickers. */
export type ContextPopupControl = ContextPopupMode
