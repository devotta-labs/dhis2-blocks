import {
    Checkbox,
    MultiSelectField,
    MultiSelectOption,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import React from 'react'
import { z } from 'zod'
import type { WorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import type { FilterValue, WorkingListField } from '../../domain/model'
import type { FilterEditorKind } from '../../registry/valueTypes'
import { useWorkingListText } from '../WorkingListText'
import { CalendarRangeFields } from './CalendarRangeFields'
import styles from './FilterControls.module.css'
import {
    type FilterCalendarContext,
    RelativeDatePeriodSchema,
    optionDisplayName,
} from './filterValueSupport'
import {
    OrganisationUnitFilterSelect,
    UserFilterSelect,
} from './ReferenceFilterSelects'

export const usesMultipleOptionSelection = (
    field: WorkingListField,
    capabilities: WorkingListCapabilities
) => capabilities.multipleOptionValues && field.source !== 'system'

export const EditorValue = ({
    client,
    field,
    editor,
    value,
    capabilities,
    calendarContext,
    onChange,
}: {
    client: WorkingListClient
    field: WorkingListField
    editor: FilterEditorKind
    value: FilterValue
    capabilities: WorkingListCapabilities
    calendarContext: FilterCalendarContext
    onChange: (value: FilterValue) => void
}) => {
    const translate = useWorkingListText()
    const i18n = { t: translate }
    if (field.id === 'assignedUser' || field.id === 'eventAssignedUser') {
        const assignee =
            value.kind === 'assignee'
                ? value
                : ({ kind: 'assignee', mode: 'CURRENT' } as const)
        return (
            <div className={styles['assignee-filter-editor']}>
                <SingleSelectField
                    dense
                    label={i18n.t('Assignment')}
                    selected={assignee.mode}
                    onChange={({ selected }) =>
                        onChange({
                            kind: 'assignee',
                            mode: z
                                .enum(['CURRENT', 'PROVIDED', 'NONE', 'ANY'])
                                .parse(selected),
                        })
                    }
                >
                    <SingleSelectOption
                        value="CURRENT"
                        label={i18n.t('Current user')}
                    />
                    <SingleSelectOption
                        value="PROVIDED"
                        label={i18n.t('Specific users')}
                    />
                    <SingleSelectOption
                        value="NONE"
                        label={i18n.t('Unassigned')}
                    />
                    <SingleSelectOption
                        value="ANY"
                        label={i18n.t('Any assigned user')}
                    />
                </SingleSelectField>
                {assignee.mode === 'PROVIDED' && (
                    <UserFilterSelect
                        client={client}
                        selected={assignee.userIds ?? []}
                        onChange={(userIds) =>
                            onChange({
                                kind: 'assignee',
                                mode: 'PROVIDED',
                                userIds,
                            })
                        }
                    />
                )}
            </div>
        )
    }

    if (field.options?.length) {
        const values = value.kind === 'options' ? value.values : []
        // Tracker supports multiple option-set values on capable servers, but
        // Capture's system status filters are intentionally single-valued.
        if (usesMultipleOptionSelection(field, capabilities)) {
            return (
                <MultiSelectField
                    dense
                    filterable
                    label={i18n.t('Values')}
                    selected={values}
                    noMatchText={i18n.t('No values match')}
                    onChange={({ selected }) =>
                        onChange({ kind: 'options', values: selected })
                    }
                >
                    {field.options.map((option) => (
                        <MultiSelectOption
                            key={option.code}
                            value={option.code}
                            label={optionDisplayName(field, option, translate)}
                        />
                    ))}
                </MultiSelectField>
            )
        }
        return (
            <SingleSelectField
                dense
                filterable
                label={i18n.t('Value')}
                selected={values[0]}
                noMatchText={i18n.t('No values match')}
                onChange={({ selected }) =>
                    onChange({ kind: 'options', values: [selected] })
                }
            >
                {field.options.map((option) => (
                    <SingleSelectOption
                        key={option.code}
                        value={option.code}
                        label={optionDisplayName(field, option, translate)}
                    />
                ))}
            </SingleSelectField>
        )
    }

    if (editor === 'boolean') {
        const values = value.kind === 'boolean' ? value.values : []
        return (
            <div
                className={styles['boolean-editor']}
                role="group"
                aria-label={i18n.t('Values')}
            >
                <Checkbox
                    label={i18n.t('Yes')}
                    checked={values.includes(true)}
                    onChange={({ checked }) =>
                        onChange({
                            kind: 'boolean',
                            values: checked
                                ? [...values.filter((item) => !item), true]
                                : values.filter((item) => !item),
                        })
                    }
                />
                <Checkbox
                    label={i18n.t('No')}
                    checked={values.includes(false)}
                    onChange={({ checked }) =>
                        onChange({
                            kind: 'boolean',
                            values: checked
                                ? [...values.filter(Boolean), false]
                                : values.filter(Boolean),
                        })
                    }
                />
            </div>
        )
    }

    if (editor === 'dateRange') {
        const date: Extract<FilterValue, { kind: 'dateRange' }> =
            value.kind === 'dateRange'
                ? value
                : { kind: 'dateRange', mode: 'absolute' }
        return (
            <div className={styles['date-range-editor']}>
                <SingleSelectField
                    dense
                    dataTest={`date-mode-${field.id}`}
                    label={i18n.t('Date range type')}
                    selected={date.mode}
                    onChange={({ selected }) =>
                        onChange(
                            selected === 'relative'
                                ? {
                                      kind: 'dateRange',
                                      mode: 'relative',
                                      period: 'THIS_MONTH',
                                  }
                                : {
                                      kind: 'dateRange',
                                      mode: 'absolute',
                                  }
                        )
                    }
                >
                    <SingleSelectOption
                        value="absolute"
                        label={i18n.t('Specific dates')}
                    />
                    <SingleSelectOption
                        value="relative"
                        label={i18n.t('Relative period')}
                    />
                </SingleSelectField>
                {date.mode === 'absolute' ? (
                    <CalendarRangeFields
                        start={date.start}
                        end={date.end}
                        startLabel={i18n.t('From')}
                        endLabel={i18n.t('To')}
                        calendarContext={calendarContext}
                        onChange={(start, end) =>
                            onChange({
                                kind: 'dateRange',
                                mode: 'absolute',
                                start,
                                end,
                            })
                        }
                    />
                ) : (
                    <>
                        <SingleSelectField
                            dense
                            dataTest={`relative-kind-${field.id}`}
                            label={i18n.t('Relative range type')}
                            selected={date.period ? 'period' : 'buffers'}
                            onChange={({ selected }) =>
                                onChange(
                                    selected === 'period'
                                        ? {
                                              kind: 'dateRange',
                                              mode: 'relative',
                                              period: 'THIS_MONTH',
                                          }
                                        : {
                                              kind: 'dateRange',
                                              mode: 'relative',
                                              startBuffer: -30,
                                              endBuffer: 0,
                                          }
                                )
                            }
                        >
                            <SingleSelectOption
                                value="period"
                                label={i18n.t('Named period')}
                            />
                            <SingleSelectOption
                                value="buffers"
                                label={i18n.t('Day offsets')}
                            />
                        </SingleSelectField>
                        {date.period ? (
                            <SingleSelectField
                                dense
                                dataTest={`relative-period-${field.id}`}
                                label={i18n.t('Relative period')}
                                selected={date.period}
                                onChange={({ selected }) =>
                                    onChange({
                                        kind: 'dateRange',
                                        mode: 'relative',
                                        period: RelativeDatePeriodSchema.parse(
                                            selected
                                        ),
                                    })
                                }
                            >
                                <SingleSelectOption
                                    value="TODAY"
                                    label={i18n.t('Today')}
                                />
                                <SingleSelectOption
                                    value="THIS_WEEK"
                                    label={i18n.t('This week')}
                                />
                                <SingleSelectOption
                                    value="LAST_WEEK"
                                    label={i18n.t('Last week')}
                                />
                                <SingleSelectOption
                                    value="THIS_MONTH"
                                    label={i18n.t('This month')}
                                />
                                <SingleSelectOption
                                    value="LAST_MONTH"
                                    label={i18n.t('Last month')}
                                />
                                <SingleSelectOption
                                    value="LAST_3_MONTHS"
                                    label={i18n.t('Last three months')}
                                />
                                <SingleSelectOption
                                    value="THIS_YEAR"
                                    label={i18n.t('This year')}
                                />
                            </SingleSelectField>
                        ) : (
                            <RangeFields
                                type="number"
                                min={date.startBuffer}
                                max={date.endBuffer}
                                minLabel={i18n.t('Start buffer')}
                                maxLabel={i18n.t('End buffer')}
                                onChange={(startBuffer, endBuffer) =>
                                    onChange({
                                        kind: 'dateRange',
                                        mode: 'relative',
                                        startBuffer:
                                            startBuffer === undefined
                                                ? undefined
                                                : Number(startBuffer),
                                        endBuffer:
                                            endBuffer === undefined
                                                ? undefined
                                                : Number(endBuffer),
                                    })
                                }
                            />
                        )}
                    </>
                )}
            </div>
        )
    }
    if (editor === 'numberRange') {
        const range =
            value.kind === 'numberRange'
                ? value
                : { kind: 'numberRange' as const }
        return (
            <RangeFields
                type="number"
                min={range.min}
                max={range.max}
                minLabel={i18n.t('Minimum')}
                maxLabel={i18n.t('Maximum')}
                onChange={(min, max) =>
                    onChange({
                        kind: 'numberRange',
                        min: min === undefined ? undefined : Number(min),
                        max: max === undefined ? undefined : Number(max),
                    })
                }
            />
        )
    }
    if (editor === 'timeRange') {
        const range =
            value.kind === 'timeRange' ? value : { kind: 'timeRange' as const }
        return (
            <RangeFields
                type="time"
                min={range.min}
                max={range.max}
                minLabel={i18n.t('From')}
                maxLabel={i18n.t('To')}
                onChange={(min, max) =>
                    onChange({ kind: 'timeRange', min, max })
                }
            />
        )
    }
    if (editor === 'organisationUnit') {
        const id = value.kind === 'organisationUnit' ? value.id : ''
        return (
            <OrganisationUnitFilterSelect
                client={client}
                selectedId={id}
                onChange={(nextId) =>
                    onChange({ kind: 'organisationUnit', id: nextId })
                }
            />
        )
    }
    const text = value.kind === 'text' ? value.value : ''
    const minimumCharacters =
        field.minCharactersToSearch !== undefined &&
        field.minCharactersToSearch > 0
            ? field.minCharactersToSearch
            : undefined
    return (
        <label className={styles['native-field']}>
            <span>{i18n.t('Value')}</span>
            <input
                autoFocus
                value={text}
                minLength={minimumCharacters}
                onChange={(event) =>
                    onChange({ kind: 'text', value: event.target.value })
                }
            />
            {minimumCharacters !== undefined && (
                <small>
                    {i18n.t('Enter at least {{count}} characters', {
                        count: minimumCharacters,
                    })}
                </small>
            )}
        </label>
    )
}

const RangeFields = ({
    type,
    min,
    max,
    minLabel,
    maxLabel,
    placeholder,
    onChange,
}: {
    type: 'number' | 'text' | 'time'
    min?: string | number
    max?: string | number
    minLabel: string
    maxLabel: string
    placeholder?: string
    onChange: (min: string | undefined, max: string | undefined) => void
}) => (
    <div className={styles['range-editor']}>
        <label className={styles['native-field']}>
            <span>{minLabel}</span>
            <input
                type={type}
                placeholder={placeholder}
                value={min ?? ''}
                onChange={(event) =>
                    onChange(
                        event.target.value || undefined,
                        max === undefined ? undefined : String(max)
                    )
                }
            />
        </label>
        <label className={styles['native-field']}>
            <span>{maxLabel}</span>
            <input
                type={type}
                placeholder={placeholder}
                value={max ?? ''}
                onChange={(event) =>
                    onChange(
                        min === undefined ? undefined : String(min),
                        event.target.value || undefined
                    )
                }
            />
        </label>
    </div>
)
