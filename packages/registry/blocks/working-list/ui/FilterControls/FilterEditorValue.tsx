import React from 'react'
import type { WorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import { usesMultipleOptionSelection } from '../../domain/filterControlPolicy'
import {
    RELATIVE_DATE_PERIODS,
    type FilterValue,
    type RelativeDatePeriod,
    type WorkingListField,
} from '../../domain/model'
import type { FilterEditorKind } from '../../registry/valueTypes'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import { Label } from '@/components/dhis2/ui/label'
import {
    useWorkingListText,
    type WorkingListTranslate,
} from '../WorkingListText'
import { CalendarRangeFields } from './CalendarRangeFields'
import {
    ComboboxField,
    SelectField,
    type SelectFieldOption,
} from './FilterSelectFields'
import {
    type FilterCalendarContext,
    optionDisplayName,
} from './filterValueSupport'
import {
    OrganisationUnitFilterSelect,
    UserFilterSelect,
} from './ReferenceFilterSelects'

const relativePeriodOptions = (
    translate: WorkingListTranslate
): SelectFieldOption<RelativeDatePeriod>[] => {
    const labels = {
        TODAY: translate('Today'),
        THIS_WEEK: translate('This week'),
        LAST_WEEK: translate('Last week'),
        THIS_MONTH: translate('This month'),
        LAST_MONTH: translate('Last month'),
        LAST_3_MONTHS: translate('Last three months'),
        THIS_YEAR: translate('This year'),
    } satisfies Record<RelativeDatePeriod, string>
    return RELATIVE_DATE_PERIODS.map((value) => ({
        value,
        label: labels[value],
    }))
}

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
            <div className="[&>*+*]:mt-[12px]">
                <SelectField
                    label={i18n.t('Assignment')}
                    value={assignee.mode}
                    options={[
                        { value: 'CURRENT', label: i18n.t('Current user') },
                        { value: 'PROVIDED', label: i18n.t('Specific users') },
                        { value: 'NONE', label: i18n.t('Unassigned') },
                        { value: 'ANY', label: i18n.t('Any assigned user') },
                    ]}
                    onChange={(mode) => onChange({ kind: 'assignee', mode })}
                />
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
        const optionItems = field.options.map((option) => ({
            value: option.code,
            label: optionDisplayName(field, option, translate),
        }))
        // Tracker supports multiple option-set values on capable servers, but
        // Capture's system status filters are intentionally single-valued.
        if (usesMultipleOptionSelection(field, capabilities)) {
            return (
                <ComboboxField
                    multiple
                    label={i18n.t('Values')}
                    values={values}
                    options={optionItems}
                    noMatchText={i18n.t('No values match')}
                    onChange={(selected) =>
                        onChange({ kind: 'options', values: selected })
                    }
                />
            )
        }
        return (
            <ComboboxField
                label={i18n.t('Value')}
                values={values}
                options={optionItems}
                noMatchText={i18n.t('No values match')}
                onChange={(selected) =>
                    onChange({ kind: 'options', values: selected })
                }
            />
        )
    }

    if (editor === 'boolean') {
        const values = value.kind === 'boolean' ? value.values : []
        return (
            <div
                className="flex flex-wrap items-center gap-[8px]"
                role="group"
                aria-label={i18n.t('Values')}
            >
                <Label className="cursor-pointer">
                    <Checkbox
                        checked={values.includes(true)}
                        onCheckedChange={(checked) =>
                            onChange({
                                kind: 'boolean',
                                values: checked
                                    ? [...values.filter((item) => !item), true]
                                    : values.filter((item) => !item),
                            })
                        }
                    />
                    {i18n.t('Yes')}
                </Label>
                <Label className="cursor-pointer">
                    <Checkbox
                        checked={values.includes(false)}
                        onCheckedChange={(checked) =>
                            onChange({
                                kind: 'boolean',
                                values: checked
                                    ? [...values.filter(Boolean), false]
                                    : values.filter(Boolean),
                            })
                        }
                    />
                    {i18n.t('No')}
                </Label>
            </div>
        )
    }

    if (editor === 'dateRange') {
        const date: Extract<FilterValue, { kind: 'dateRange' }> =
            value.kind === 'dateRange'
                ? value
                : { kind: 'dateRange', mode: 'absolute' }
        return (
            <div className="min-w-0 max-w-full [&>*+*]:mt-[12px]">
                <SelectField
                    dataTest={`date-mode-${field.id}`}
                    label={i18n.t('Date range type')}
                    value={date.mode}
                    options={[
                        { value: 'absolute', label: i18n.t('Specific dates') },
                        { value: 'relative', label: i18n.t('Relative period') },
                    ]}
                    onChange={(mode) =>
                        onChange(
                            mode === 'relative'
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
                />
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
                        <SelectField
                            dataTest={`relative-kind-${field.id}`}
                            label={i18n.t('Relative range type')}
                            value={date.period ? 'period' : 'buffers'}
                            options={[
                                {
                                    value: 'period',
                                    label: i18n.t('Named period'),
                                },
                                {
                                    value: 'buffers',
                                    label: i18n.t('Day offsets'),
                                },
                            ]}
                            onChange={(kind) =>
                                onChange(
                                    kind === 'period'
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
                        />
                        {date.period ? (
                            <SelectField
                                dataTest={`relative-period-${field.id}`}
                                label={i18n.t('Relative period')}
                                value={date.period}
                                options={relativePeriodOptions(translate)}
                                onChange={(period) =>
                                    onChange({
                                        kind: 'dateRange',
                                        mode: 'relative',
                                        period,
                                    })
                                }
                            />
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
        <label className="flex flex-col gap-[5px] [&>span]:text-[12px] [&>span]:[font-weight:500] [&>span]:text-[#36454f] [&_input]:box-border [&_input]:h-[32px] [&_input]:w-full [&_input]:rounded-[3px] [&_input]:bg-[#fff] [&_input]:text-[14px] [&_input]:leading-[16px] [&_input]:text-[#212934] [&_input]:outline-none [&_input]:[border:1px_solid_#a9b7c4] [&_input]:[padding:7px_8px] [&_input:hover]:border-[#6c7785] [&_input:focus]:border-[#147cd7] [&_input:focus]:[box-shadow:0_0_0_2px_rgb(20_124_215_/_20%)] [&_small]:text-[12px] [&_small]:text-[#6c7785]">
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
    <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-[10px] [@media(max-width:560px)]:grid-cols-1">
        <label className="flex flex-col gap-[5px] [&>span]:text-[12px] [&>span]:[font-weight:500] [&>span]:text-[#36454f] [&_input]:box-border [&_input]:h-[32px] [&_input]:w-full [&_input]:rounded-[3px] [&_input]:bg-[#fff] [&_input]:text-[14px] [&_input]:leading-[16px] [&_input]:text-[#212934] [&_input]:outline-none [&_input]:[border:1px_solid_#a9b7c4] [&_input]:[padding:7px_8px] [&_input:hover]:border-[#6c7785] [&_input:focus]:border-[#147cd7] [&_input:focus]:[box-shadow:0_0_0_2px_rgb(20_124_215_/_20%)] [&_small]:text-[12px] [&_small]:text-[#6c7785]">
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
        <label className="flex flex-col gap-[5px] [&>span]:text-[12px] [&>span]:[font-weight:500] [&>span]:text-[#36454f] [&_input]:box-border [&_input]:h-[32px] [&_input]:w-full [&_input]:rounded-[3px] [&_input]:bg-[#fff] [&_input]:text-[14px] [&_input]:leading-[16px] [&_input]:text-[#212934] [&_input]:outline-none [&_input]:[border:1px_solid_#a9b7c4] [&_input]:[padding:7px_8px] [&_input:hover]:border-[#6c7785] [&_input:focus]:border-[#147cd7] [&_input:focus]:[box-shadow:0_0_0_2px_rgb(20_124_215_/_20%)] [&_small]:text-[12px] [&_small]:text-[#6c7785]">
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
