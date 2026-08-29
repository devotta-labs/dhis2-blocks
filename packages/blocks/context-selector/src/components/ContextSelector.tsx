import type { ReactNode } from 'react'
import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { SelectorBar } from '@dhis2/ui'

export interface ContextSelectorProps {
    children: ReactNode
    ariaLabel?: string
    onClear?: () => void
    clearDisabled?: boolean
}

export const ContextSelector = ({
    children,
    ariaLabel = i18n.t('Context selector'),
    onClear,
    clearDisabled = false,
}: ContextSelectorProps) => (
    <nav
        className="sticky top-0 z-[1000] w-full"
        aria-label={ariaLabel}
        data-test="context-selector"
        data-testid="context-selector"
    >
        <SelectorBar
            ariaLabel={ariaLabel}
            className="w-full max-w-none!"
            dataTest="context-selector-bar"
            disableClearSelections={!onClear || clearDisabled}
            onClearSelectionClick={onClear}
        >
            {children}
        </SelectorBar>
    </nav>
)
