import type { ReactNode } from 'react'
import React, { useEffect, useMemo, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { CircularLoader, Input, Menu, MenuDivider, MenuItem } from '@dhis2/ui'
import type { ContextControlMode, ContextOption } from '../types'
import { ContextOptionLabel } from './ContextOptionLabel'
import {
    capitalizeFirst,
    CaptureSelectorBarItem,
    lowerCaseFirst,
} from './internal'

export interface ContextOptionSelectorProps {
    label: string
    options: readonly ContextOption[]
    selectedValue?: string | null
    control: ContextControlMode
    noValueMessage?: string
    searchPlaceholder?: string
    dataTest?: string
    children?: ReactNode
}

const LoadingIndicator = ({ label }: { label: string }) => (
    <div className="flex h-full items-center justify-center" aria-label={label}>
        <CircularLoader />
    </div>
)

interface CaptureOptionSelectorProps extends ContextOptionSelectorProps {
    structure: 'program' | 'locked'
}

/**
 * Controlled, menu-based selector matching Capture's SingleLockedSelect.
 * Filtering is local UI state and appears only when the host supplies >10 items.
 */
export const CaptureOptionSelector = ({
    label,
    options,
    selectedValue,
    control,
    noValueMessage,
    searchPlaceholder,
    dataTest,
    children,
    structure,
}: CaptureOptionSelectorProps) => {
    const [filter, setFilter] = useState('')
    const normalizedLabel = capitalizeFirst(label)
    const normalizedDataTest =
        dataTest ?? `${lowerCaseFirst(label)}-selector-container`
    const conciseDataTest = normalizedDataTest.replace(
        /-selector-container$/,
        ''
    )
    const selectedOption = options.find(
        (option) => option.value === selectedValue
    )
    const manyOptions = options.length > 10
    const interactive = control.mode === 'interactive'
    const open = interactive && control.open
    const displayOnly = control.mode === 'display' || control.mode === 'loading'
    const disabled = control.mode === 'disabled'
    useEffect(() => {
        if (!open) {
            setFilter('')
        }
    }, [open])
    const visibleOptions = useMemo(() => {
        const normalizedFilter = filter.toLowerCase()
        return options.filter((option) =>
            option.label.toLowerCase().includes(normalizedFilter)
        )
    }, [filter, options])
    const emptyMessage =
        noValueMessage ??
        i18n.t('Choose a {{title}}', {
            title: lowerCaseFirst(label),
            interpolation: { escapeValue: false },
        })
    const value = selectedOption ? (
        <ContextOptionLabel
            icon={selectedOption.icon}
            label={selectedOption.label}
        />
    ) : undefined

    const selectOption = (valueToSelect: string | undefined) => {
        if (!interactive || !valueToSelect) {
            return
        }
        control.onSelect(valueToSelect)
        control.onOpenChange(false)
    }

    const clearSelection = () => {
        if (!interactive || !control.onClear) {
            return
        }
        control.onOpenChange(false)
        control.onClear()
    }

    if (control.mode === 'loading') {
        const loader = (
            <LoadingIndicator
                label={control.loadingLabel ?? i18n.t('Loading')}
            />
        )
        return structure === 'locked' ? (
            <span data-test="single-locked-select">{loader}</span>
        ) : (
            loader
        )
    }

    const selector = (
        <CaptureSelectorBarItem
            disabled={disabled}
            displayOnly={displayOnly}
            label={normalizedLabel}
            value={value}
            noValueMessage={interactive ? emptyMessage : ''}
            open={open}
            setOpen={interactive ? control.onOpenChange : undefined}
            onClearSelectionClick={
                (interactive || control.mode === 'display') &&
                selectedOption &&
                control.onClear
                    ? control.onClear
                    : undefined
            }
            dataTest={normalizedDataTest}
        >
            {interactive ? (
                <div
                    className={`max-h-[80vh] overflow-auto${structure === 'program' ? ' pb-[4px]' : ''}`}
                >
                    <Menu>
                        {manyOptions ? (
                            <>
                                <Input
                                    dense
                                    className="sticky! top-0 z-[1] bg-white px-[8px] pt-[8px] pb-[4px]"
                                    dataTest={`${conciseDataTest}-filterinput`}
                                    value={filter}
                                    onChange={({ value: nextFilter }) =>
                                        setFilter(nextFilter ?? '')
                                    }
                                    type="text"
                                    placeholder={
                                        searchPlaceholder ??
                                        i18n.t('Search for a {{title}}', {
                                            title: lowerCaseFirst(label),
                                            interpolation: {
                                                escapeValue: false,
                                            },
                                        })
                                    }
                                    initialFocus
                                />
                                {visibleOptions.length > 0 ? (
                                    visibleOptions.map((option) => (
                                        <MenuItem
                                            key={option.value}
                                            label={
                                                <ContextOptionLabel
                                                    icon={option.icon}
                                                    label={option.label}
                                                />
                                            }
                                            value={option.value}
                                            disabled={option.disabled}
                                            onClick={({ value: nextValue }) =>
                                                selectOption(nextValue)
                                            }
                                            suffix=""
                                        />
                                    ))
                                ) : (
                                    <div className="flex justify-center px-[8px] py-[16px] text-[14px] text-[#4a5768]">
                                        <span>
                                            {i18n.t('No results found for ')}
                                            {filter}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            options.map((option) => (
                                <MenuItem
                                    key={option.value}
                                    label={
                                        <ContextOptionLabel
                                            icon={option.icon}
                                            label={option.label}
                                        />
                                    }
                                    value={option.value}
                                    disabled={option.disabled}
                                    onClick={({ value: nextValue }) =>
                                        selectOption(nextValue)
                                    }
                                    suffix=""
                                />
                            ))
                        )}
                        {children}
                        {selectedOption && manyOptions && control.onClear ? (
                            <>
                                <MenuDivider />
                                <MenuItem
                                    dense
                                    onClick={clearSelection}
                                    label={i18n.t('Clear selection')}
                                    suffix=""
                                />
                            </>
                        ) : null}
                    </Menu>
                </div>
            ) : null}
        </CaptureSelectorBarItem>
    )

    return structure === 'locked' ? (
        <span data-test="single-locked-select">{selector}</span>
    ) : (
        selector
    )
}

export const ContextOptionSelector = (props: ContextOptionSelectorProps) => (
    <CaptureOptionSelector {...props} structure="locked" />
)
