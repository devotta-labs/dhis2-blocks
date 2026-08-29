import type { ReactNode } from 'react'
import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { CircularLoader } from '@dhis2/ui'
import { CaptureSelectorBarItem } from './internal'

const ignoreOpenChange = () => undefined

export interface OrganisationUnitSelectorProps {
    value?: string
    onClear?: () => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
    loading?: boolean
    loadingLabel?: string
    disabled?: boolean
    readOnly?: boolean
    children?: ReactNode
    label?: string
    placeholder?: string
}

/**
 * Capture-sized popup shell for a host-owned organisation-unit picker.
 * Tree data, selection state, path expansion and picker callbacks stay outside.
 */
export const OrganisationUnitSelector = ({
    value,
    onClear,
    open: requestedOpen = false,
    onOpenChange,
    loading = false,
    loadingLabel,
    disabled = false,
    readOnly = false,
    children,
    label = i18n.t('Organisation unit'),
    placeholder = i18n.t('Choose an organisation unit'),
}: OrganisationUnitSelectorProps) => {
    if (loading) {
        return (
            <div
                className="flex h-full items-center justify-center"
                aria-label={loadingLabel ?? i18n.t('Loading')}
            >
                <CircularLoader />
            </div>
        )
    }

    const interactive = !disabled && !readOnly

    return (
        <CaptureSelectorBarItem
            label={label}
            value={value}
            noValueMessage={
                interactive
                    ? placeholder
                    : readOnly
                      ? i18n.t('None selected')
                      : ''
            }
            disabled={disabled}
            displayOnly={readOnly && !disabled}
            open={interactive && requestedOpen}
            setOpen={
                interactive ? (onOpenChange ?? ignoreOpenChange) : undefined
            }
            onClearSelectionClick={
                !disabled && !readOnly && value && onClear ? onClear : undefined
            }
            dataTest="org-unit-selector-container"
        >
            {interactive ? (
                <div className="min-h-[96px] min-w-[640px] max-h-[80vh] overflow-auto">
                    {children}
                </div>
            ) : null}
        </CaptureSelectorBarItem>
    )
}
