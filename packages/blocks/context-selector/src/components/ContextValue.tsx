import type { ReactElement } from 'react'
import React from 'react'
import { CaptureSelectorBarItem } from './internal'

export interface ContextValueProps {
    label: string
    value?: string | ReactElement
    placeholder?: string
    onClear?: () => void
}

/** A non-interactive selector-bar value for committed context or host actions. */
export const ContextValue = ({
    label,
    value,
    placeholder = '',
    onClear,
}: ContextValueProps) => (
    <CaptureSelectorBarItem
        displayOnly
        label={label}
        value={value}
        noValueMessage={placeholder}
        onClearSelectionClick={value ? onClear : undefined}
    />
)
