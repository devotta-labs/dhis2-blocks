import React, { useState, type ReactNode } from 'react'
import i18n from '@dhis2/d2-i18n'
import { CircularLoader, Input, Menu, MenuDivider, MenuItem } from '@dhis2/ui'
import type { Option, SelectorProps } from '../types'
import { OptionLabel } from './OptionLabel'
import { capitalizeFirst, lowerCaseFirst, SelectorBarItem } from './internal'

export interface OptionSelectorProps extends Omit<SelectorProps, 'label'> {
    label: string
}

const LoadingIndicator = ({ label }: { label: string }) => (
    <div className="flex h-full items-center justify-center" aria-label={label}>
        <CircularLoader />
    </div>
)

const ignoreOpenChange = () => undefined

interface OptionMenuProps {
    options: readonly Option[]
    searchPlaceholder: string
    filterDataTest: string
    onSelect: (value: string | undefined) => void
    /** Adds Capture's clear-selection footer to a searchable menu. */
    onClear?: () => void
    children?: ReactNode
}

/**
 * The open menu. It mounts with the popup, so the filter text starts empty
 * every time the popup opens without an effect to reset it.
 */
const OptionMenu = ({
    options,
    searchPlaceholder,
    filterDataTest,
    onSelect,
    onClear,
    children,
}: OptionMenuProps) => {
    const [filter, setFilter] = useState('')
    // Capture adds the filter input and the clear footer above ten options.
    const searchable = options.length > 10
    const search = searchable ? filter.toLowerCase() : ''
    const items = options
        .filter((option) => option.label.toLowerCase().includes(search))
        .map((option) => (
            <MenuItem
                key={option.value}
                ariaLabel={option.label}
                label={<OptionLabel icon={option.icon} label={option.label} />}
                value={option.value}
                disabled={option.disabled}
                onClick={({ value }) => onSelect(value)}
                suffix=""
            />
        ))

    return (
        <Menu>
            {searchable ? (
                <>
                    <Input
                        dense
                        className="sticky! top-0 z-[1] bg-white px-[8px] pt-[8px] pb-[4px]"
                        dataTest={filterDataTest}
                        value={filter}
                        onChange={({ value }) => setFilter(value ?? '')}
                        type="text"
                        placeholder={searchPlaceholder}
                        initialFocus
                    />
                    {items.length > 0 ? (
                        items
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
                items
            )}
            {children}
            {searchable && onClear ? (
                <>
                    <MenuDivider />
                    <MenuItem
                        dense
                        onClick={onClear}
                        label={i18n.t('Clear selection')}
                        suffix=""
                    />
                </>
            ) : null}
        </Menu>
    )
}

interface MenuSelectorProps extends Omit<
    SelectorProps,
    'label' | 'placeholder' | 'searchPlaceholder'
> {
    label: string
    dataTest: string
    emptyMessage: string
    readOnlyEmptyMessage?: string
    searchPlaceholder: string
    contentClassName: string
}

export const MenuSelector = ({
    label,
    options,
    value,
    onChange,
    onClear,
    open: requestedOpen = false,
    onOpenChange,
    loading = false,
    loadingLabel,
    disabled = false,
    readOnly = false,
    searchPlaceholder,
    dataTest,
    children,
    emptyMessage,
    readOnlyEmptyMessage = '',
    contentClassName,
}: MenuSelectorProps) => {
    if (loading) {
        return <LoadingIndicator label={loadingLabel ?? i18n.t('Loading')} />
    }

    const selectedOption = options.find((option) => option.value === value)
    const interactive = !disabled && !readOnly
    const displayOnly = !disabled && readOnly
    const open = interactive && requestedOpen
    const inactiveEmptyMessage = displayOnly ? readOnlyEmptyMessage : ''

    const selectOption = (valueToSelect: string | undefined) => {
        if (!valueToSelect) {
            return
        }
        onChange?.(valueToSelect)
        onOpenChange?.(false)
    }

    const clearSelection = () => {
        onOpenChange?.(false)
        onClear?.()
    }

    return (
        <SelectorBarItem
            disabled={disabled}
            displayOnly={displayOnly}
            label={capitalizeFirst(label)}
            value={
                selectedOption ? (
                    <OptionLabel
                        icon={selectedOption.icon}
                        label={selectedOption.label}
                    />
                ) : undefined
            }
            noValueMessage={interactive ? emptyMessage : inactiveEmptyMessage}
            open={open}
            setOpen={
                interactive ? (onOpenChange ?? ignoreOpenChange) : undefined
            }
            onClearSelectionClick={
                !disabled && selectedOption && onClear ? onClear : undefined
            }
            dataTest={dataTest}
        >
            {open ? (
                <div className={contentClassName}>
                    <OptionMenu
                        options={options.filter(
                            (option) => !option.excludeFromMenu
                        )}
                        searchPlaceholder={searchPlaceholder}
                        filterDataTest={`${dataTest.replace(/-selector-container$/, '')}-filterinput`}
                        onSelect={selectOption}
                        onClear={
                            selectedOption && onClear
                                ? clearSelection
                                : undefined
                        }
                    >
                        {children}
                    </OptionMenu>
                </div>
            ) : null}
        </SelectorBarItem>
    )
}

interface FramedOptionSelectorProps extends OptionSelectorProps {
    dataTest: string
}

export const FramedOptionSelector = ({
    label,
    placeholder,
    searchPlaceholder,
    dataTest,
    ...props
}: FramedOptionSelectorProps) => (
    <span data-test="single-locked-select">
        <MenuSelector
            {...props}
            label={label}
            dataTest={dataTest}
            emptyMessage={
                placeholder ??
                i18n.t('Choose a {{title}}', {
                    title: lowerCaseFirst(label),
                    interpolation: { escapeValue: false },
                })
            }
            searchPlaceholder={
                searchPlaceholder ??
                i18n.t('Search for a {{title}}', {
                    title: label,
                    interpolation: { escapeValue: false },
                })
            }
            contentClassName="max-h-[80vh] overflow-auto"
        />
    </span>
)

export const OptionSelector = (props: OptionSelectorProps) => (
    <FramedOptionSelector
        {...props}
        dataTest={`${lowerCaseFirst(props.label)}-selector-container`}
    />
)
