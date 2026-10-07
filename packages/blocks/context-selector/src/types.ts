import type { ReactNode } from 'react'

export interface OptionIcon {
    source?: string
    color?: string
    alternativeText?: string
}

export interface Option {
    value: string
    label: string
    icon?: OptionIcon
    disabled?: boolean
    excludeFromMenu?: boolean
}

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
