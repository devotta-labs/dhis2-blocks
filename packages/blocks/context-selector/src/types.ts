import type { ReactNode } from 'react'

/** Host-resolved icon data. The block deliberately does not depend on metadata APIs. */
export interface OptionIcon {
    source?: string
    color?: string
    alternativeText?: string
}

/** A host-resolved selector option. Metadata objects stay outside the block. */
export interface Option {
    value: string
    label: string
    icon?: OptionIcon
    disabled?: boolean
    /** Resolve a committed value without offering it in the open menu. */
    excludeFromMenu?: boolean
}

/**
 * Shared direct contract for option-backed selectors.
 *
 * State precedence is loading > disabled > readOnly > interactive. Loading and
 * disabled selectors expose no interactions. Read-only selectors cannot open
 * or change, but remain clearable when onClear is supplied.
 */
export interface SelectorProps {
    options: readonly Option[]
    value?: string
    onChange?: (value: string) => void
    onClear?: () => void

    open?: boolean
    onOpenChange?: (open: boolean) => void

    loading?: boolean
    loadingLabel?: string
    disabled?: boolean
    readOnly?: boolean

    label?: string
    placeholder?: string
    searchPlaceholder?: string
    children?: ReactNode
}
