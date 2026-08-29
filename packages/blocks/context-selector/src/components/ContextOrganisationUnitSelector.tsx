import type { ReactNode } from 'react'
import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { CircularLoader } from '@dhis2/ui'
import type { ContextPopupMode } from '../types'
import { CaptureSelectorBarItem } from './internal'

export interface ContextOrganisationUnitSelectorProps {
    value?: ReactNode
    control: ContextPopupMode
    children?: ReactNode
    label?: string
    noValueMessage?: string
    dataTest?: string
}

/**
 * Capture-sized popup shell for a host-owned organisation-unit picker.
 * Tree data, selection state, path expansion and picker callbacks stay outside.
 */
export const ContextOrganisationUnitSelector = ({
    value,
    control,
    children,
    label = i18n.t('Organisation unit'),
    noValueMessage = i18n.t('Choose an organisation unit'),
    dataTest = 'org-unit-selector-container',
}: ContextOrganisationUnitSelectorProps) => {
    if (control.mode === 'loading') {
        return (
            <div
                className="flex h-full items-center justify-center"
                aria-label={control.loadingLabel ?? i18n.t('Loading')}
            >
                <CircularLoader />
            </div>
        )
    }

    const interactive = control.mode === 'interactive'
    const displayOnly = control.mode === 'display'
    const disabled = control.mode === 'disabled'

    return (
        <CaptureSelectorBarItem
            label={label}
            value={value}
            noValueMessage={
                interactive
                    ? noValueMessage
                    : control.mode === 'display'
                      ? i18n.t('None selected')
                      : ''
            }
            disabled={disabled}
            displayOnly={displayOnly}
            open={interactive && control.open}
            setOpen={interactive ? control.onOpenChange : undefined}
            onClearSelectionClick={
                (interactive || control.mode === 'display') && value
                    ? control.onClear
                    : undefined
            }
            dataTest={dataTest}
        >
            {interactive ? (
                <div className="min-h-[96px] min-w-[640px] max-h-[80vh] overflow-auto">
                    {children}
                </div>
            ) : null}
        </CaptureSelectorBarItem>
    )
}
