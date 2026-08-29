import {
    Button,
    Checkbox,
    MenuDivider,
    SingleSelect,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import React, { useId, useState } from 'react'
import { z } from 'zod'
import type { WorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import {
    FILTER_OPERATORS,
    type AppliedFilter,
    type FilterOperator,
    type FilterValue,
    type WorkingListField,
} from '../../domain/model'
import {
    getAllowedFilterOperators,
    getValueTypeDefinition,
    validateAppliedFilter,
    type FilterSerializationContext,
} from '../../registry/valueTypes'
import { useWorkingListText } from '../WorkingListText'
import {
    FilterPopover,
    configureFilterCombobox,
    focusFirstControl,
    useEscapeToClose,
} from './FilterControlPrimitives'
import styles from './FilterControls.module.css'
import { EditorValue } from './FilterEditorValue'
import {
    defaultValue,
    fieldDisplayName,
    summaryForFilter,
    translatedOperator,
    type FilterCalendarContext,
} from './filterValueSupport'

interface FilterButtonProps {
    client: WorkingListClient
    field: WorkingListField
    filter?: AppliedFilter
    capabilities: WorkingListCapabilities
    validationContext?: FilterSerializationContext
    calendarContext: FilterCalendarContext
    defaultOpen?: boolean
    prefix?: string
    disabled?: boolean
    onApply: (filter: AppliedFilter) => void
    onReset: () => void
    onRemove?: () => void
}

export const FilterButton = ({
    field,
    client,
    filter,
    capabilities,
    validationContext,
    calendarContext,
    defaultOpen,
    prefix,
    disabled = false,
    onApply,
    onReset,
    onRemove,
}: FilterButtonProps) => {
    const translate = useWorkingListText()
    const i18n = { t: translate }
    const editorId = useId()
    const [buttonElement, setButtonElement] = useState<HTMLDivElement | null>(
        null
    )
    const [open, setOpen] = useState(defaultOpen ?? false)
    const summary = summaryForFilter(filter, translate)
    const displayPrefix = prefix ?? fieldDisplayName(field, translate)

    const setEditorOpen = (nextOpen: boolean) => {
        configureFilterCombobox(
            buttonElement,
            `[data-test="filter-${field.id}-select"] [tabindex]`,
            nextOpen,
            editorId,
            displayPrefix,
            `[data-test="filter-${field.id}-select-clear"]`,
            i18n.t('Clear {{filter}} filter', { filter: displayPrefix })
        )
        setOpen(nextOpen)
    }
    const close = () => {
        setEditorOpen(false)
        requestAnimationFrame(() =>
            buttonElement
                ?.querySelector<HTMLElement>(
                    `[data-test="filter-${field.id}-select"] [tabindex]`
                )
                ?.focus()
        )
    }
    useEscapeToClose(open, close)

    return (
        <div
            ref={(element) => {
                if (element && element !== buttonElement) {
                    setButtonElement(element)
                    configureFilterCombobox(
                        element,
                        `[data-test="filter-${field.id}-select"] [tabindex]`,
                        open,
                        editorId,
                        displayPrefix,
                        `[data-test="filter-${field.id}-select-clear"]`,
                        i18n.t('Clear {{filter}} filter', {
                            filter: displayPrefix,
                        })
                    )
                }
            }}
            className={styles['filter-control']}
            data-testid={`filter-${field.id}`}
            onMouseDownCapture={(event) => {
                if (disabled) {
                    return
                }
                const target =
                    event.target instanceof Element ? event.target : null
                if (
                    !target?.closest(
                        `[data-test="filter-${field.id}-select-clear"]`
                    )
                ) {
                    return
                }
                // A click outside closes the editor popover on mouse-down.
                // Clear before that dismissal can consume the subsequent click.
                event.preventDefault()
                event.stopPropagation()
                onReset()
                onRemove?.()
            }}
            onClickCapture={(event) => {
                if (disabled) {
                    return
                }
                const target =
                    event.target instanceof Element ? event.target : null
                const select = target?.closest(
                    `[data-test="filter-${field.id}-select"]`
                )
                if (!select && target !== event.currentTarget) {
                    return
                }
                if (
                    target?.closest(
                        `[data-test="filter-${field.id}-select-clear"]`
                    )
                ) {
                    return
                }
                event.preventDefault()
                event.stopPropagation()
                setEditorOpen(!open)
            }}
            onKeyDownCapture={(event) => {
                if (disabled) {
                    return
                }
                const target =
                    event.target instanceof Element ? event.target : null
                if (
                    ['Enter', ' ', 'ArrowDown'].includes(event.key) &&
                    target?.closest(
                        `[data-test="filter-${field.id}-select"] [tabindex]`
                    )
                ) {
                    event.preventDefault()
                    event.stopPropagation()
                    setEditorOpen(true)
                }
            }}
        >
            <SingleSelect
                dense
                clearable
                clearText={i18n.t('Clear filter')}
                dataTest={`filter-${field.id}-select`}
                disabled={disabled}
                prefix={`${displayPrefix}:`}
                selected="current-filter"
                onChange={({ selected }) => {
                    if (!selected) {
                        onReset()
                        onRemove?.()
                    }
                }}
            >
                <SingleSelectOption
                    value="current-filter"
                    label={summary ?? i18n.t('All')}
                />
            </SingleSelect>
            {open && !disabled && buttonElement && (
                <FilterPopover
                    arrow={false}
                    maxWidth={400}
                    placement="bottom-start"
                    reference={buttonElement}
                    onClickOutside={close}
                >
                    <div className={styles['filter-popover-sheet']}>
                        <FilterEditor
                            key={`${field.id}-${JSON.stringify(filter?.value)}`}
                            id={editorId}
                            field={field}
                            client={client}
                            filter={filter}
                            capabilities={capabilities}
                            validationContext={validationContext}
                            calendarContext={calendarContext}
                            onApply={(next) => {
                                onApply(next)
                                close()
                            }}
                            onReset={() => {
                                onReset()
                                close()
                            }}
                        />
                    </div>
                </FilterPopover>
            )}
        </div>
    )
}

interface FilterEditorProps extends Omit<FilterButtonProps, 'onReset'> {
    id: string
    onReset: () => void
}

const FilterEditor = ({
    id,
    field,
    client,
    filter,
    capabilities,
    validationContext,
    calendarContext,
    onApply,
    onReset,
}: FilterEditorProps) => {
    const translate = useWorkingListText()
    const i18n = { t: translate }
    const definition = getValueTypeDefinition(field.valueType)
    const operators = getAllowedFilterOperators(field, capabilities)
    const isTrueOnly = definition.editor === 'trueOnly'
    const initialOperator = filter?.operator ?? operators[0] ?? 'equals'
    const [operator, setOperator] = useState<FilterOperator>(initialOperator)
    const [value, setValue] = useState<FilterValue>(
        filter?.value ??
            (isTrueOnly
                ? { kind: 'boolean', values: [] }
                : defaultValue(field, definition.editor))
    )
    const [error, setError] = useState<string>()

    const trueOnlyHasValue = value.kind === 'trueOnly' || value.kind === 'empty'

    const apply = () => {
        try {
            const next = validateAppliedFilter(
                { field, operator, value },
                capabilities,
                validationContext
            )
            setError(undefined)
            onApply(next)
        } catch {
            setError(
                i18n.t(
                    'The filter value is invalid. Review the value and try again.'
                )
            )
        }
    }

    return (
        <form
            ref={focusFirstControl}
            id={id}
            className={styles['filter-editor']}
            data-testid={`filter-editor-${field.id}`}
            role="dialog"
            aria-label={fieldDisplayName(field, translate)}
            onSubmit={(event) => {
                event.preventDefault()
                apply()
            }}
        >
            <h3>{fieldDisplayName(field, translate)}</h3>
            {!isTrueOnly && operators.length > 1 && (
                <SingleSelectField
                    dense
                    dataTest={`filter-operator-${field.id}`}
                    label={i18n.t('Match')}
                    selected={operator}
                    onChange={({ selected }) => {
                        const parsed = z.enum(FILTER_OPERATORS).parse(selected)
                        setOperator(parsed)
                        setValue((current) => {
                            if (parsed === 'empty' || parsed === 'notEmpty') {
                                return {
                                    kind: 'empty',
                                    isEmpty: parsed === 'empty',
                                }
                            }
                            return current.kind === 'empty'
                                ? defaultValue(field, definition.editor)
                                : current
                        })
                    }}
                >
                    {operators.map((item) => (
                        <SingleSelectOption
                            key={item}
                            value={item}
                            label={translatedOperator(item, translate)}
                        />
                    ))}
                </SingleSelectField>
            )}
            {isTrueOnly ? (
                <div
                    className={styles['true-only-editor']}
                    role="group"
                    aria-label={i18n.t('Values')}
                >
                    {operators.includes('empty') && (
                        <Checkbox
                            dense
                            dataTest={`true-only-empty-${field.id}`}
                            label={translatedOperator('empty', translate)}
                            checked={
                                operator === 'empty' && value.kind === 'empty'
                            }
                            onChange={({ checked }) => {
                                setOperator(checked ? 'empty' : 'equals')
                                setValue(
                                    checked
                                        ? { kind: 'empty', isEmpty: true }
                                        : { kind: 'boolean', values: [] }
                                )
                            }}
                        />
                    )}
                    {operators.includes('notEmpty') && (
                        <Checkbox
                            dense
                            dataTest={`true-only-not-empty-${field.id}`}
                            label={translatedOperator('notEmpty', translate)}
                            checked={
                                operator === 'notEmpty' &&
                                value.kind === 'empty'
                            }
                            onChange={({ checked }) => {
                                setOperator(checked ? 'notEmpty' : 'equals')
                                setValue(
                                    checked
                                        ? { kind: 'empty', isEmpty: false }
                                        : { kind: 'boolean', values: [] }
                                )
                            }}
                        />
                    )}
                    {(operators.includes('empty') ||
                        operators.includes('notEmpty')) && (
                        <MenuDivider dataTest="true-only-divider" />
                    )}
                    <Checkbox
                        dense
                        dataTest={`true-only-yes-${field.id}`}
                        label={i18n.t('Yes')}
                        checked={value.kind === 'trueOnly'}
                        onChange={({ checked }) => {
                            setOperator('equals')
                            setValue(
                                checked
                                    ? { kind: 'trueOnly', value: true }
                                    : { kind: 'boolean', values: [] }
                            )
                        }}
                    />
                </div>
            ) : operator !== 'empty' && operator !== 'notEmpty' ? (
                <div data-testid={`filter-value-${field.id}`}>
                    <EditorValue
                        client={client}
                        field={field}
                        editor={definition.editor}
                        value={value}
                        capabilities={capabilities}
                        calendarContext={calendarContext}
                        onChange={setValue}
                    />
                </div>
            ) : null}
            {error && (
                <p className={styles['filter-editor__error']} role="alert">
                    {error}
                </p>
            )}
            <div className={styles['filter-editor__actions']}>
                <Button
                    primary
                    small
                    type="submit"
                    dataTest={`filter-update-${field.id}`}
                    disabled={isTrueOnly && !trueOnlyHasValue}
                >
                    {i18n.t('Update')}
                </Button>
                <Button
                    small
                    type="button"
                    dataTest={`filter-reset-${field.id}`}
                    onClick={onReset}
                >
                    {i18n.t('Reset filter')}
                </Button>
            </div>
        </form>
    )
}
