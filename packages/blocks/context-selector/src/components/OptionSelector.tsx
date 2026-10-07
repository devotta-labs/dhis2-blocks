import React, { useMemo, useState } from 'react'
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

interface MenuSelectorContentProps {
    options: SelectorProps['options']
    searchPlaceholder: string
    dataTest: string
    contentClassName: string
    onSelect: (value: string | undefined) => void
    onClearSelection?: () => void
    children?: React.ReactNode
}

const MenuSelectorContent = ({
    options,
    searchPlaceholder,
    dataTest,
    contentClassName,
    onSelect,
    onClearSelection,
    children,
}: MenuSelectorContentProps) => {
    const [filter, setFilter] = useState('')
    const manyOptions = options.length > 10

    const visibleOptions = useMemo(() => {
        const normalizedFilter = filter.toLowerCase()

        return options.filter((option) =>
            option.label.toLowerCase().includes(normalizedFilter)
        )
    }, [filter, options])

    return (
        <div className={contentClassName}>
            <Menu>
                {manyOptions ? (
                    <>
                        <div className="sticky top-0 z-[1] bg-white px-[8px] pt-[8px] pb-[4px]">
                            <Input
                                dense
                                dataTest={`${dataTest}-filterinput`}
                                value={filter}
                                onChange={({ value: nextFilter }) =>
                                    setFilter(nextFilter ?? '')
                                }
                                type="text"
                                placeholder={searchPlaceholder}
                                initialFocus
                            />
                        </div>
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
                                        onSelect(nextValue)
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
                                onSelect(nextValue)
                            }
                            suffix=""
                        />
                    ))
                )}
                {children}
                {manyOptions && onClearSelection ? (
                    <>
                        <MenuDivider />
                        <MenuItem
                            dense
                            onClick={onClearSelection}
                            label={i18n.t('Clear selection')}
                            suffix=""
                        />
                    </>
                ) : null}
            </Menu>
        </div>
    )
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

    const interactive = !loading && !disabled && !readOnly
    const open = interactive && requestedOpen
    const displayOnly = !loading && !disabled && readOnly

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

    return (
        <SelectorBarItem
            disabled={disabled}
            displayOnly={displayOnly}
            label={normalizedLabel}
            value={value}
            noValueMessage={
                interactive
                    ? emptyMessage
                    : displayOnly
                      ? readOnlyEmptyMessage
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
            {open ? (
                <MenuSelectorContent
                    options={menuOptions}
                    searchPlaceholder={searchPlaceholder}
                    dataTest={conciseDataTest}
                    contentClassName={contentClassName}
                    onSelect={selectOption}
                    onClearSelection={
                        selectedOption && onClear ? clearSelection : undefined
                    }
                >
                    {children}
                </MenuSelectorContent>
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
