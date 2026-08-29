import React, { useEffect, useMemo, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { CircularLoader, Input, Menu, MenuDivider, MenuItem } from '@dhis2/ui'
import type { SelectorProps } from '../types'
import { OptionLabel } from './OptionLabel'
import {
    capitalizeFirst,
    CaptureSelectorBarItem,
    lowerCaseFirst,
} from './internal'

// SAFETY: @dhis2/ui reads ariaLabel at runtime when label is a React node, but
// the published MenuItem declaration omits it.
const AccessibleMenuItem = MenuItem as React.ComponentType<
    React.ComponentProps<typeof MenuItem> & { ariaLabel?: string }
>

export interface OptionSelectorProps extends Omit<SelectorProps, 'label'> {
    label: string
}

const LoadingIndicator = ({ label }: { label: string }) => (
    <div className="flex h-full items-center justify-center" aria-label={label}>
        <CircularLoader />
    </div>
)

const ignoreOpenChange = () => undefined

interface CaptureOptionSelectorProps extends SelectorProps {
    label: string
    structure: 'program' | 'locked'
    dataTest: string
}

/**
 * Controlled, menu-based selector matching Capture's SingleLockedSelect.
 * Filtering is local UI state and appears only when the host supplies >10 items.
 */
export const CaptureOptionSelector = ({
    label,
    options,
    value: currentValue,
    onChange,
    onClear,
    open: requestedOpen = false,
    onOpenChange,
    loading = false,
    loadingLabel,
    disabled = false,
    readOnly = false,
    placeholder,
    searchPlaceholder,
    dataTest,
    children,
    structure,
}: CaptureOptionSelectorProps) => {
    const [filter, setFilter] = useState('')
    const normalizedLabel = capitalizeFirst(label)
    const normalizedDataTest = dataTest
    const conciseDataTest = normalizedDataTest.replace(
        /-selector-container$/,
        ''
    )
    const selectedOption = options.find(
        (option) => option.value === currentValue
    )
    const menuOptions = useMemo(
        () => options.filter((option) => !option.excludeFromMenu),
        [options]
    )
    const manyOptions = menuOptions.length > 10
    const interactive = !loading && !disabled && !readOnly
    const open = interactive && requestedOpen
    const displayOnly = !loading && !disabled && readOnly
    useEffect(() => {
        if (!open) {
            setFilter('')
        }
    }, [open])
    const visibleOptions = useMemo(() => {
        const normalizedFilter = filter.toLowerCase()
        return menuOptions.filter((option) =>
            option.label.toLowerCase().includes(normalizedFilter)
        )
    }, [filter, menuOptions])
    const emptyMessage =
        placeholder ??
        i18n.t('Choose a {{title}}', {
            title: lowerCaseFirst(label),
            interpolation: { escapeValue: false },
        })
    const value = selectedOption ? (
        <OptionLabel icon={selectedOption.icon} label={selectedOption.label} />
    ) : undefined

    const selectOption = (valueToSelect: string | undefined) => {
        if (!interactive || !valueToSelect) {
            return
        }
        onChange?.(valueToSelect)
        onOpenChange?.(false)
    }

    const clearSelection = () => {
        if (!interactive || !onClear) {
            return
        }
        onOpenChange?.(false)
        onClear()
    }

    if (loading) {
        const loader = (
            <LoadingIndicator label={loadingLabel ?? i18n.t('Loading')} />
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
            noValueMessage={
                interactive || (structure === 'program' && displayOnly)
                    ? emptyMessage
                    : ''
            }
            open={open}
            setOpen={
                interactive ? (onOpenChange ?? ignoreOpenChange) : undefined
            }
            onClearSelectionClick={
                !disabled && selectedOption && onClear ? onClear : undefined
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
                                            title:
                                                structure === 'program'
                                                    ? lowerCaseFirst(label)
                                                    : label,
                                            interpolation: {
                                                escapeValue: false,
                                            },
                                        })
                                    }
                                    initialFocus
                                />
                                {visibleOptions.length > 0 ? (
                                    visibleOptions.map((option) => (
                                        <AccessibleMenuItem
                                            key={option.value}
                                            ariaLabel={option.label}
                                            label={
                                                <OptionLabel
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
                            menuOptions.map((option) => (
                                <AccessibleMenuItem
                                    key={option.value}
                                    ariaLabel={option.label}
                                    label={
                                        <OptionLabel
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
                        {selectedOption && manyOptions && onClear ? (
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

export const OptionSelector = (props: OptionSelectorProps) => (
    <CaptureOptionSelector
        {...props}
        structure="locked"
        dataTest={`${lowerCaseFirst(props.label)}-selector-container`}
    />
)
