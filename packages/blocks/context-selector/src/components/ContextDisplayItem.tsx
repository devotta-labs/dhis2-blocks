import type { ReactNode } from 'react'
import React from 'react'
import { CaptureSelectorBarItem } from './internal'

export interface ContextDisplayItemProps {
    label: string
    value?: ReactNode
    noValueMessage?: string
    onClear?: () => void
    dataTest?: string
}

/** A non-interactive selector-bar item for committed context or host actions. */
export const ContextDisplayItem = ({
    label,
    value,
    noValueMessage = '',
    onClear,
    dataTest,
}: ContextDisplayItemProps) => (
    <CaptureSelectorBarItem
        displayOnly
        label={label}
        value={value}
        noValueMessage={noValueMessage}
        onClearSelectionClick={value ? onClear : undefined}
        dataTest={dataTest}
    />
)
