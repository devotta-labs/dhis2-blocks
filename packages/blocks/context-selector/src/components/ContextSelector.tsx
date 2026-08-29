import type { ReactNode } from 'react'
import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { SelectorBar } from '@dhis2/ui'

export interface ContextSelectorClearAction {
    onClick: () => void
    disabled?: boolean
}

export interface ContextSelectorProps {
    children: ReactNode
    clearAction?: ContextSelectorClearAction
    ariaLabel?: string
    className?: string
    dataTest?: string
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
    clearAction,
    ariaLabel = i18n.t('Context selector'),
    className,
    dataTest = 'context-selector',
}: ContextSelectorProps) => (
    <nav
        className={`sticky top-0 z-[1000] w-full${className ? ` ${className}` : ''}`}
        aria-label={ariaLabel}
        data-test={dataTest}
        data-testid={dataTest}
    >
        <CaptureSelectorBar
            ariaLabel={ariaLabel}
            dataTest={`${dataTest}-bar`}
            disableClearSelections={
                !clearAction || Boolean(clearAction.disabled)
            }
            onClearSelectionClick={clearAction?.onClick}
        >
            {children}
        </CaptureSelectorBar>
    </nav>
)
