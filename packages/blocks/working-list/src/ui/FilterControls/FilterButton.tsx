import { Button } from '@/registry/dhis2/ui/button'
import React, { useState } from 'react'
import type { WorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import {
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
import { Checkbox } from '@/registry/dhis2/ui/checkbox'
import { Label } from '@/registry/dhis2/ui/label'
import { Separator } from '@/registry/dhis2/ui/separator'
import { useWorkingListText } from '../WorkingListText'
import { PopoverTitle } from '@/registry/dhis2/ui/popover'
import { FilterChip } from './FilterControlPrimitives'
import { EditorValue } from './FilterEditorValue'
import { SelectField } from './FilterSelectFields'
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
    const [open, setOpen] = useState(defaultOpen ?? false)
    const summary = summaryForFilter(filter, translate)
    const displayPrefix = prefix ?? fieldDisplayName(field, translate)

    return (
        <FilterChip
            dataTest={`filter-${field.id}`}
            testId={`filter-${field.id}`}
            prefix={`${displayPrefix}:`}
            value={summary ?? i18n.t('All')}
            clearLabel={i18n.t('Clear {{filter}} filter', {
                filter: displayPrefix,
            })}
            disabled={disabled}
            open={open}
            onOpenChange={setOpen}
            onClear={() => {
                onReset()
                onRemove?.()
            }}
        >
            <div className="box-border w-[min(400px,calc(100vw_-_16px))] min-w-0 max-w-[calc(100vw_-_16px)] [contain:layout]">
                <FilterEditor
                    key={`${field.id}-${JSON.stringify(filter?.value)}`}
                    field={field}
                    client={client}
                    filter={filter}
                    capabilities={capabilities}
                    validationContext={validationContext}
                    calendarContext={calendarContext}
                    onApply={(next) => {
                        onApply(next)
                        setOpen(false)
                    }}
                    onReset={() => {
                        onReset()
                        setOpen(false)
                    }}
                />
            </div>
        </FilterChip>
    )
}

interface FilterEditorProps extends Omit<FilterButtonProps, 'onReset'> {
    onReset: () => void
}

const FilterEditor = ({
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
            className="box-border w-[min(380px,calc(100vw_-_32px))] min-w-0 max-w-[calc(100vw_-_32px)] p-[16px] [&>*+*]:mt-[12px] [&>*]:box-border [&>*]:min-w-0 [&>*]:max-w-full [&_[data-test]]:box-border [&_[data-test]]:min-w-0 [&_[data-test]]:max-w-full [&_[data-testid^=filter-value-]]:box-border [&_[data-testid^=filter-value-]]:min-w-0 [&_[data-testid^=filter-value-]]:max-w-full [&_:is(input,select,textarea)]:box-border [&_:is(input,select,textarea)]:min-w-0 [&_:is(input,select,textarea)]:max-w-full [&_h3]:[margin:0_0_12px]! [&_h3]:text-[#17212b] [&_h3]:[font-size:16px]! [&_h3]:[font-weight:500]!"
            data-testid={`filter-editor-${field.id}`}
            onSubmit={(event) => {
                event.preventDefault()
                apply()
            }}
        >
            <PopoverTitle render={<h3 />}>
                {fieldDisplayName(field, translate)}
            </PopoverTitle>
            {!isTrueOnly && operators.length > 1 && (
                <SelectField
                    dataTest={`filter-operator-${field.id}`}
                    label={i18n.t('Match')}
                    value={operator}
                    options={operators.map((item) => ({
                        value: item,
                        label: translatedOperator(item, translate),
                    }))}
                    onChange={(next) => {
                        setOperator(next)
                        setValue((current) => {
                            if (next === 'empty' || next === 'notEmpty') {
                                return {
                                    kind: 'empty',
                                    isEmpty: next === 'empty',
                                }
                            }
                            return current.kind === 'empty'
                                ? defaultValue(field, definition.editor)
                                : current
                        })
                    }}
                />
            )}
            {isTrueOnly ? (
                <div
                    className="flex flex-col gap-[4px]"
                    role="group"
                    aria-label={i18n.t('Values')}
                >
                    {operators.includes('empty') && (
                        <Label
                            data-test={`true-only-empty-${field.id}`}
                            className="cursor-pointer"
                        >
                            <Checkbox
                                checked={
                                    operator === 'empty' &&
                                    value.kind === 'empty'
                                }
                                onCheckedChange={(checked) => {
                                    setOperator(checked ? 'empty' : 'equals')
                                    setValue(
                                        checked
                                            ? { kind: 'empty', isEmpty: true }
                                            : { kind: 'boolean', values: [] }
                                    )
                                }}
                            />
                            {translatedOperator('empty', translate)}
                        </Label>
                    )}
                    {operators.includes('notEmpty') && (
                        <Label
                            data-test={`true-only-not-empty-${field.id}`}
                            className="cursor-pointer"
                        >
                            <Checkbox
                                checked={
                                    operator === 'notEmpty' &&
                                    value.kind === 'empty'
                                }
                                onCheckedChange={(checked) => {
                                    setOperator(checked ? 'notEmpty' : 'equals')
                                    setValue(
                                        checked
                                            ? { kind: 'empty', isEmpty: false }
                                            : { kind: 'boolean', values: [] }
                                    )
                                }}
                            />
                            {translatedOperator('notEmpty', translate)}
                        </Label>
                    )}
                    {(operators.includes('empty') ||
                        operators.includes('notEmpty')) && (
                        <Separator
                            className="my-2"
                            data-test="true-only-divider"
                        />
                    )}
                    <Label
                        data-test={`true-only-yes-${field.id}`}
                        className="cursor-pointer"
                    >
                        <Checkbox
                            checked={value.kind === 'trueOnly'}
                            onCheckedChange={(checked) => {
                                setOperator('equals')
                                setValue(
                                    checked
                                        ? { kind: 'trueOnly', value: true }
                                        : { kind: 'boolean', values: [] }
                                )
                            }}
                        />
                        {i18n.t('Yes')}
                    </Label>
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
                <p
                    className="text-[13px] text-[#c62828] [margin:10px_0_0]"
                    role="alert"
                >
                    {error}
                </p>
            )}
            <div className="flex flex-wrap gap-[8px] pt-[12px] [border-top:1px_solid_#e8edf2]">
                <Button
                    size="sm"
                    type="submit"
                    data-test={`filter-update-${field.id}`}
                    disabled={isTrueOnly && !trueOnlyHasValue}
                >
                    {i18n.t('Update')}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    data-test={`filter-reset-${field.id}`}
                    onClick={onReset}
                >
                    {i18n.t('Reset filter')}
                </Button>
            </div>
        </form>
    )
}
