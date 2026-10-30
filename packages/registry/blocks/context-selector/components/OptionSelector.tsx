import React, { useEffect, useMemo, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { CircularLoader, Input, Menu, MenuDivider, MenuItem } from '@dhis2/ui'
import type { SelectorProps } from '../types'
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
    value: currentValue,
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
        return <LoadingIndicator label={loadingLabel ?? i18n.t('Loading')} />
    }

    const inactiveEmptyMessage = displayOnly ? readOnlyEmptyMessage : ''

    return (
        <SelectorBarItem
            disabled={disabled}
            displayOnly={displayOnly}
            label={normalizedLabel}
            value={value}
            noValueMessage={interactive ? emptyMessage : inactiveEmptyMessage}
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
                <div className={contentClassName}>
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
                                    placeholder={searchPlaceholder}
                                    initialFocus
                                />
                                {visibleOptions.length > 0 ? (
                                    visibleOptions.map((option) => (
                                        <MenuItem
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
                                <MenuItem
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
