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

type SelectorBarRuntimeProps = {
    children: ReactNode
    ariaLabel?: string
    className?: string
    dataTest?: string
    disableClearSelections?: boolean
    onClearSelectionClick?: () => void
}

// SAFETY: This adds the runtime-supported ariaLabel omitted by some @dhis2/ui declarations.
const CaptureSelectorBar =
    SelectorBar as React.ComponentType<SelectorBarRuntimeProps>

/**
 * Capture-parity sticky selector row. Child visibility and ordering are owned by
 * the host; this component only supplies layout, toolbar semantics and clear-all.
 */
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
        <CaptureSelectorBar
            ariaLabel={ariaLabel}
            className="w-full max-w-none!"
            dataTest="context-selector-bar"
            disableClearSelections={!onClear || clearDisabled}
            onClearSelectionClick={onClear}
        >
            {children}
        </CaptureSelectorBar>
    </nav>
)
