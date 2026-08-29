import type { ReactElement } from 'react'
import React from 'react'
import { SelectorBarItem } from './internal'

export interface ContextValueProps {
    label: string
    value?: string | ReactElement
    placeholder?: string
    onClear?: () => void
}

export const ContextValue = ({
    label,
    value,
    placeholder = '',
    onClear,
}: ContextValueProps) => (
    <SelectorBarItem
        displayOnly
        label={label}
        value={value}
        noValueMessage={placeholder}
        onClearSelectionClick={value ? onClear : undefined}
    />
)
