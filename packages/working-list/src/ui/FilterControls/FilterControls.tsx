import {
    Button,
    CalendarInput,
    Checkbox,
    FlyoutMenu,
    MenuItem,
    MultiSelectField,
    MultiSelectOption,
    OrganisationUnitTree,
    Popover,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import { IconCross16 } from '@dhis2/ui-icons'
import { useQuery } from '@tanstack/react-query'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import type { WorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import type { TrackerProgram } from '../../api/schemas'
import type {
    WorkingListCalendar,
    WorkingListDateFormat,
} from '../../api/systemInfo'
import {
    RELATIVE_DATE_PERIODS,
    type AppliedFilter,
    type FilterOperator,
    type FilterValue,
    type WorkingListField,
} from '../../domain/model'
import { toMultiCalendarIdentifier } from '../../registry/transformers'
import {
    getAllowedFilterOperators,
    getValueTypeDefinition,
    validateAppliedFilter,
    type FilterEditorKind,
    type FilterSerializationContext,
} from '../../registry/valueTypes'
import {
    defaultWorkingListTranslate,
    useWorkingListText,
    type WorkingListTranslate,
} from '../WorkingListText'
import styles from './FilterControls.module.css'

// CalendarInput supports this at runtime (and documents it in PropTypes), but
// @dhis2/ui 10.11 omits the prop from its declaration bundle.
const StrictCalendarInput = CalendarInput as React.ComponentType<
    React.ComponentProps<typeof CalendarInput> & { strictValidation?: boolean }
>

const useEscapeToClose = (open: boolean, onClose: () => void) => {
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose
    useEffect(() => {
        if (!open) {
            return
        }
        const dismiss = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onCloseRef.current()
            }
        }
        document.addEventListener('keydown', dismiss)
        return () => document.removeEventListener('keydown', dismiss)
    }, [open])
}

const translatedOperator = (
    operator: FilterOperator,
    translate: WorkingListTranslate
) => {
    switch (operator) {
        case 'like':
            return translate('Contains')
        case 'startsWith':
            return translate('Starts with')
        case 'endsWith':
            return translate('Ends with')
        case 'equals':
            return translate('Equals')
        case 'range':
            return translate('Between')
        case 'greaterThan':
            return translate('Greater than')
        case 'greaterThanOrEqual':
            return translate('At least')
        case 'lessThan':
            return translate('Less than')
        case 'lessThanOrEqual':
            return translate('At most')
        case 'in':
            return translate('Is one of')
        case 'empty':
            return translate('Is empty')
        case 'notEmpty':
            return translate('Is not empty')
    }
}

export const fieldDisplayName = (
    field: WorkingListField,
    translate: WorkingListTranslate = defaultWorkingListTranslate
) => {
    const labels: Record<string, string> = {
        enrollmentStatus: translate('Enrollment status'),
        enrolledAt: translate('Enrollment date'),
        enrollmentOccurredAt: translate('Incident date'),
        followUp: translate('Follow up'),
        assignedUser: translate('Assigned to'),
        eventOccurredAt: translate('Report date'),
        eventStatus: translate('Event status'),
        eventScheduledAt: translate('Scheduled date'),
        eventAssignedUser: translate('Assigned to'),
        programStage: translate('Program stage'),
        createdAt: translate('Registration date'),
        programOwnerId: translate('Owner organisation unit'),
        eventOrgUnit: translate('Event organisation unit'),
    }
    return labels[field.id] ?? field.displayName
}

const optionDisplayName = (
    field: WorkingListField,
    option: { code: string; displayName: string },
    translate: WorkingListTranslate = defaultWorkingListTranslate
) => {
    if (field.source !== 'system') {
        return option.displayName
    }
    switch (option.code) {
        case 'ACTIVE':
            return translate('Active')
        case 'COMPLETED':
            return translate('Completed')
        case 'CANCELLED':
            return translate('Cancelled')
        case 'SCHEDULE':
            return translate('Scheduled')
        case 'OVERDUE':
            return translate('Overdue')
        case 'SKIPPED':
            return translate('Skipped')
        case 'VISITED':
            return translate('Visited')
        default:
            return option.displayName
    }
}

export const localizedField = (
    field: WorkingListField,
    translate: WorkingListTranslate = defaultWorkingListTranslate
): WorkingListField => ({
    ...field,
    displayName: fieldDisplayName(field, translate),
    options: field.options?.map((option) => ({
        ...option,
        displayName: optionDisplayName(field, option, translate),
    })),
})

const UserReferenceSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().min(1),
        username: z.string().optional(),
    })
    .passthrough()

const UsersResponseSchema = z
    .object({ users: z.array(UserReferenceSchema) })
    .passthrough()

const OrganisationUnitReferenceSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().optional(),
        path: z.string().min(1),
    })
    .passthrough()

const RelativeDatePeriodSchema = z.enum(RELATIVE_DATE_PERIODS)

const CalendarSelectionSchema = z.union([
    z.null(),
    z
        .object({
            calendarDateString: z.string().nullable(),
            validation: z
                .object({
                    valid: z.boolean(),
                    error: z.boolean().optional(),
                    warning: z.boolean().optional(),
                    validationText: z.string().optional(),
                })
                .passthrough()
                .optional(),
        })
        .passthrough(),
])

interface CalendarValidationFeedback {
    valid: boolean
    error?: boolean
    warning?: boolean
    validationText?: string
}

export interface FilterCalendarContext {
    calendar: WorkingListCalendar
    dateFormat: WorkingListDateFormat
    locale?: string
    /** Validated server zone, retained until CalendarInput consumes it safely. */
    timeZone: string
}

export const canonicalDateToCalendarInput = (
    value: string | undefined,
    format: WorkingListDateFormat
) => {
    if (!value || format === 'YYYY-MM-DD') {
        return value
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}

export const calendarInputDateToCanonical = (
    value: string | null | undefined,
    format: WorkingListDateFormat
) => {
    if (!value || format === 'YYYY-MM-DD') {
        return value || undefined
    }
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}

const OrganisationUnitRootsSchema = z
    .object({ organisationUnits: z.array(OrganisationUnitReferenceSchema) })
    .passthrough()

const UserFilterSelect = ({
    client,
    selected,
    onChange,
}: {
    client: WorkingListClient
    selected: string[]
    onChange: (selected: string[]) => void
}) => {
    const i18n = { t: useWorkingListText() }
    const [search, setSearch] = useState('')
    const usersQuery = useQuery({
        queryKey: ['working-list', 'users', search],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'users',
                    params: {
                        fields: 'id,displayName,username',
                        pageSize: 50,
                        ...(search.trim() ? { query: search.trim() } : {}),
                    },
                },
                UsersResponseSchema,
                signal
            ),
        staleTime: 60_000,
    })
    const users = usersQuery.data?.users ?? []
    const knownIds = new Set(users.map((user) => user.id))

    return (
        <div
            className={styles['reference-filter-editor']}
            data-testid="assignee-user-selector"
        >
            <label className={styles['native-field']}>
                <span>{i18n.t('Search users')}</span>
                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
            </label>
            <MultiSelectField
                dense
                dataTest="assignee-users"
                label={i18n.t('Users')}
                loading={usersQuery.isPending || usersQuery.isFetching}
                selected={selected}
                noMatchText={i18n.t('No users match')}
                onChange={({ selected: next }) => onChange(next)}
            >
                {users.map((user) => (
                    <MultiSelectOption
                        key={user.id}
                        value={user.id}
                        label={
                            user.username
                                ? `${user.displayName} (${user.username})`
                                : user.displayName
                        }
                    />
                ))}
                {selected
                    .filter((id) => !knownIds.has(id))
                    .map((id) => (
                        <MultiSelectOption key={id} value={id} label={id} />
                    ))}
            </MultiSelectField>
            {usersQuery.error && (
                <p role="alert">
                    {i18n.t('Could not load users')}: {String(usersQuery.error)}
                </p>
            )}
        </div>
    )
}

const OrganisationUnitFilterSelect = ({
    client,
    selectedId,
    onChange,
}: {
    client: WorkingListClient
    selectedId: string
    onChange: (id: string) => void
}) => {
    const i18n = { t: useWorkingListText() }
    const rootsQuery = useQuery({
        queryKey: ['working-list', 'filter-organisation-unit-roots'],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'me',
                    params: {
                        fields: 'organisationUnits[id,displayName,path]',
                    },
                },
                OrganisationUnitRootsSchema,
                signal
            ),
        staleTime: 60 * 60_000,
    })
    const selectedQuery = useQuery({
        queryKey: ['working-list', 'filter-organisation-unit', selectedId],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'organisationUnits',
                    id: selectedId,
                    params: { fields: 'id,displayName,path' },
                },
                OrganisationUnitReferenceSchema,
                signal
            ),
        enabled: Boolean(selectedId),
        staleTime: 60 * 60_000,
    })
    const roots = rootsQuery.data?.organisationUnits ?? []

    if (rootsQuery.error || selectedQuery.error) {
        return <p role="alert">{i18n.t('Could not load organisation units')}</p>
    }

    return (
        <div
            className={`${styles['reference-filter-editor']} ${styles['organisation-unit-filter-tree']}`}
            data-testid="filter-organisation-unit-tree"
            aria-busy={rootsQuery.isPending || selectedQuery.isPending}
        >
            {rootsQuery.isPending ? (
                <p>{i18n.t('Loading organisation units…')}</p>
            ) : (
                <OrganisationUnitTree
                    roots={roots.map((root) => root.id)}
                    selected={
                        selectedQuery.data ? [selectedQuery.data.path] : []
                    }
                    singleSelection
                    initiallyExpanded={roots.map((root) => root.path)}
                    onChange={(payload) => {
                        if (payload.checked) {
                            onChange(payload.id)
                        }
                    }}
                />
            )}
        </div>
    )
}

const defaultValue = (
    field: WorkingListField,
    editor: FilterEditorKind
): FilterValue => {
    if (field.id === 'assignedUser' || field.id === 'eventAssignedUser') {
        return { kind: 'assignee', mode: 'CURRENT' }
    }
    if (field.options?.length) {
        return { kind: 'options', values: [] }
    }
    switch (editor) {
        case 'numberRange':
            return { kind: 'numberRange' }
        case 'timeRange':
            return { kind: 'timeRange' }
        case 'dateRange':
            return { kind: 'dateRange', mode: 'absolute' }
        case 'boolean':
            return { kind: 'boolean', values: [] }
        case 'trueOnly':
            return { kind: 'trueOnly', value: true }
        case 'organisationUnit':
            return { kind: 'organisationUnit', id: '' }
        default:
            return { kind: 'text', value: '' }
    }
}

const summaryForFilter = (
    filter: AppliedFilter | undefined,
    translate: WorkingListTranslate
) => {
    const i18n = { t: translate }
    if (!filter) {
        return undefined
    }
    const { value } = filter
    if (value.kind === 'empty') {
        return value.isEmpty ? i18n.t('Empty') : i18n.t('Not empty')
    }
    if (value.kind === 'text') {
        return value.value
    }
    if (value.kind === 'options') {
        return value.values
            .map((code) =>
                (() => {
                    const option = filter.field.options?.find(
                        (candidate) => candidate.code === code
                    )
                    return option
                        ? optionDisplayName(filter.field, option, translate)
                        : code
                })()
            )
            .join(', ')
    }
    if (value.kind === 'boolean') {
        return value.values
            .map((item) => (item ? i18n.t('Yes') : i18n.t('No')))
            .join(', ')
    }
    if (value.kind === 'trueOnly') {
        return i18n.t('Yes')
    }
    if (value.kind === 'organisationUnit') {
        return value.id
    }
    if (value.kind === 'assignee') {
        if (value.mode === 'CURRENT') {
            return i18n.t('Current user')
        }
        if (value.mode === 'NONE') {
            return i18n.t('Unassigned')
        }
        if (value.mode === 'ANY') {
            return i18n.t('Any assigned user')
        }
        return value.userIds?.join(', ') || i18n.t('Selected users')
    }
    if (value.kind === 'dateRange') {
        if (value.mode === 'relative') {
            switch (value.period) {
                case 'TODAY':
                    return i18n.t('Today')
                case 'THIS_WEEK':
                    return i18n.t('This week')
                case 'LAST_WEEK':
                    return i18n.t('Last week')
                case 'THIS_MONTH':
                    return i18n.t('This month')
                case 'LAST_MONTH':
                    return i18n.t('Last month')
                case 'LAST_3_MONTHS':
                    return i18n.t('Last three months')
                case 'THIS_YEAR':
                    return i18n.t('This year')
                default:
                    return i18n.t('{{start}} to {{end}} days', {
                        start: value.startBuffer ?? 0,
                        end: value.endBuffer ?? 0,
                    })
            }
        }
        return [value.start, value.end].filter(Boolean).join(' – ')
    }
    if (value.kind === 'numberRange' || value.kind === 'timeRange') {
        return [value.min, value.max]
            .filter((item) => item !== undefined)
            .join(' – ')
    }
    return undefined
}

interface MoreFiltersProps {
    fields: WorkingListField[]
    visibleFilterIds: string[]
    scope: 'tracked-entity' | 'event'
    includeProgramStage?: boolean
    onAdd: (fieldId: string) => void
}

export const MoreFilters = ({
    fields,
    visibleFilterIds,
    scope,
    includeProgramStage,
    onAdd,
}: MoreFiltersProps) => {
    const translate = useWorkingListText()
    const i18n = { t: translate }
    const [buttonElement, setButtonElement] =
        useState<HTMLButtonElement | null>(null)
    const [menuElement, setMenuElement] = useState<HTMLDivElement | null>(null)
    const [open, setOpen] = useState(false)
    const available = fields.filter(
        (field) => field.filterable && !visibleFilterIds.includes(field.id)
    )
    const hasProgramStage =
        includeProgramStage && !visibleFilterIds.includes('programStage')

    const close = () => {
        setOpen(false)
        requestAnimationFrame(() => buttonElement?.focus())
    }
    useEscapeToClose(open, close)
    useEffect(() => {
        if (!open || !menuElement) {
            return
        }
        const frame = requestAnimationFrame(() => {
            menuElement
                .querySelector<HTMLElement>(
                    '[data-test^="add-filter-"][tabindex]'
                )
                ?.focus()
        })
        return () => cancelAnimationFrame(frame)
    }, [menuElement, open])
    if (!available.length && !hasProgramStage) {
        return null
    }

    return (
        <div className={styles['more-filters-menu']}>
            <button
                ref={setButtonElement}
                type="button"
                className={styles['filter-button']}
                data-testid={`more-filters-${scope}`}
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((value) => !value)}
            >
                {i18n.t('More filters')}
                <span aria-hidden="true">▾</span>
            </button>
            {open && buttonElement && (
                <Popover
                    arrow={false}
                    maxWidth={400}
                    placement="bottom-start"
                    reference={buttonElement}
                    onClickOutside={close}
                >
                    <div
                        ref={setMenuElement}
                        className={styles['menu-popover-sheet']}
                    >
                        <FlyoutMenu
                            dense
                            dataTest={`more-filters-menu-${scope}`}
                            closeMenu={close}
                        >
                            {available.map((field) => (
                                <MenuItem
                                    key={field.id}
                                    dataTest={`add-filter-${field.id}`}
                                    label={fieldDisplayName(field, translate)}
                                    onClick={() => {
                                        onAdd(field.id)
                                        close()
                                    }}
                                />
                            ))}
                            {hasProgramStage && (
                                <MenuItem
                                    dataTest="add-filter-programStage"
                                    label={i18n.t('Program stage')}
                                    onClick={() => {
                                        onAdd('programStage')
                                        close()
                                    }}
                                />
                            )}
                        </FlyoutMenu>
                    </div>
                </Popover>
            )}
        </div>
    )
}

interface FilterButtonProps {
    client: WorkingListClient
    field: WorkingListField
    filter?: AppliedFilter
    capabilities: WorkingListCapabilities
    validationContext?: FilterSerializationContext
    calendarContext: FilterCalendarContext
    defaultOpen?: boolean
    onApply: (filter: AppliedFilter) => void
    onReset: () => void
}

export const FilterButton = ({
    field,
    client,
    filter,
    capabilities,
    validationContext,
    calendarContext,
    defaultOpen,
    onApply,
    onReset,
}: FilterButtonProps) => {
    const translate = useWorkingListText()
    const [buttonElement, setButtonElement] =
        useState<HTMLButtonElement | null>(null)
    const [open, setOpen] = useState(defaultOpen ?? false)
    const summary = summaryForFilter(filter, translate)

    const close = () => {
        setOpen(false)
        requestAnimationFrame(() => buttonElement?.focus())
    }
    useEscapeToClose(open, close)

    return (
        <div className={styles['filter-control']}>
            <button
                ref={setButtonElement}
                type="button"
                className={`${styles['filter-button']}${
                    summary ? ` ${styles['filter-button--active']}` : ''
                }`}
                data-testid={`filter-${field.id}`}
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => setOpen((value) => !value)}
            >
                <span>
                    {summary
                        ? translate('{{filterName}}{{escape}}', {
                              filterName: fieldDisplayName(field, translate),
                              escape: ':',
                          })
                        : fieldDisplayName(field, translate)}
                </span>
                {summary && <strong>{summary}</strong>}
                <span aria-hidden="true">▾</span>
            </button>
            {open && buttonElement && (
                <Popover
                    arrow={false}
                    maxWidth={400}
                    placement="bottom-start"
                    reference={buttonElement}
                    onClickOutside={close}
                >
                    <div className={styles['filter-popover-sheet']}>
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
                                close()
                            }}
                            onReset={() => {
                                onReset()
                                close()
                            }}
                        />
                    </div>
                </Popover>
            )}
        </div>
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
    const editorRef = useRef<HTMLFormElement>(null)
    const definition = getValueTypeDefinition(field.valueType)
    const operators = getAllowedFilterOperators(field, capabilities)
    const initialOperator = filter?.operator ?? operators[0] ?? 'equals'
    const [operator, setOperator] = useState<FilterOperator>(initialOperator)
    const [value, setValue] = useState<FilterValue>(
        filter?.value ?? defaultValue(field, definition.editor)
    )
    const [error, setError] = useState<string>()

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            editorRef.current
                ?.querySelector<HTMLElement>(
                    'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
                ?.focus()
        })
        return () => cancelAnimationFrame(frame)
    }, [])

    useEffect(() => {
        if (operator === 'empty' || operator === 'notEmpty') {
            setValue({ kind: 'empty', isEmpty: operator === 'empty' })
        } else if (value.kind === 'empty') {
            setValue(defaultValue(field, definition.editor))
        }
    }, [definition.editor, field, operator, value.kind])

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
            ref={editorRef}
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
            {operators.length > 1 && (
                <SingleSelectField
                    dense
                    dataTest={`filter-operator-${field.id}`}
                    label={i18n.t('Match')}
                    selected={operator}
                    onChange={({ selected }) =>
                        setOperator(selected as FilterOperator)
                    }
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
            {operator !== 'empty' && operator !== 'notEmpty' && (
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
            )}
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

export const usesMultipleOptionSelection = (
    field: WorkingListField,
    capabilities: WorkingListCapabilities
) => capabilities.multipleOptionValues && field.source !== 'system'

const EditorValue = ({
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
            <>
                <SingleSelectField
                    dense
                    label={i18n.t('Assignment')}
                    selected={assignee.mode}
                    onChange={({ selected }) =>
                        onChange({
                            kind: 'assignee',
                            mode: selected as typeof assignee.mode,
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
            </>
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
    if (editor === 'trueOnly') {
        return <p>{i18n.t('Only records with a true value will match.')}</p>
    }

    const text = value.kind === 'text' ? value.value : ''
    return (
        <label className={styles['native-field']}>
            <span>{i18n.t('Value')}</span>
            <input
                autoFocus
                value={text}
                minLength={field.minCharactersToSearch}
                onChange={(event) =>
                    onChange({ kind: 'text', value: event.target.value })
                }
            />
            {field.minCharactersToSearch !== undefined && (
                <small>
                    {i18n.t('Enter at least {{count}} characters', {
                        count: field.minCharactersToSearch,
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

const CalendarRangeFields = ({
    start,
    end,
    startLabel,
    endLabel,
    calendarContext,
    onChange,
}: {
    start?: string
    end?: string
    startLabel: string
    endLabel: string
    calendarContext: FilterCalendarContext
    onChange: (start: string | undefined, end: string | undefined) => void
}) => {
    const translate = useWorkingListText()
    const calendar = toMultiCalendarIdentifier(calendarContext.calendar)
    const [startValidation, setStartValidation] =
        useState<CalendarValidationFeedback>()
    const [endValidation, setEndValidation] =
        useState<CalendarValidationFeedback>()
    const handleSelection = (
        payload: unknown,
        otherValue: string | undefined,
        position: 'start' | 'end'
    ) => {
        const selection = CalendarSelectionSchema.parse(payload)
        if (position === 'start') {
            setStartValidation(selection?.validation)
        } else {
            setEndValidation(selection?.validation)
        }
        const selected = calendarInputDateToCanonical(
            selection?.calendarDateString,
            calendarContext.dateFormat
        )
        onChange(
            position === 'start' ? selected : otherValue,
            position === 'end' ? selected : otherValue
        )
    }

    // CalendarInput's own `clearable` renders a boxed "Clear" text button;
    // we render a compact icon inside the input instead. It clears the
    // committed selection along with the visible text (the input syncs to
    // the `date` prop).
    const clearButton = (position: 'start' | 'end') => {
        const validation =
            position === 'start' ? startValidation : endValidation
        return (
            <button
                type="button"
                className={`${styles['calendar-field__clear']}${
                    validation?.error || validation?.warning
                        ? ` ${styles['calendar-field__clear--status-icon']}`
                        : ''
                }`}
                data-test={`date-range-${position}-clear`}
                aria-label={translate('Clear')}
                title={translate('Clear')}
                onClick={() =>
                    handleSelection(
                        null,
                        position === 'start' ? end : start,
                        position
                    )
                }
            >
                <IconCross16 />
            </button>
        )
    }

    return (
        <div
            className={`${styles['range-editor']} ${styles['calendar-range-editor']}`}
        >
            <div className={styles['calendar-field']}>
                <StrictCalendarInput
                    dense
                    strictValidation
                    dataTest="date-range-start"
                    label={startLabel}
                    calendar={calendar}
                    locale={calendarContext.locale}
                    format={calendarContext.dateFormat}
                    error={startValidation?.error}
                    warning={startValidation?.warning}
                    validationText={startValidation?.validationText}
                    date={canonicalDateToCalendarInput(
                        start,
                        calendarContext.dateFormat
                    )}
                    inputWidth="100%"
                    width="min(320px, calc(100vw - 64px))"
                    onDateSelect={(payload) =>
                        handleSelection(payload, end, 'start')
                    }
                />
                {start && clearButton('start')}
            </div>
            <div className={styles['calendar-field']}>
                <StrictCalendarInput
                    dense
                    strictValidation
                    dataTest="date-range-end"
                    label={endLabel}
                    calendar={calendar}
                    locale={calendarContext.locale}
                    format={calendarContext.dateFormat}
                    error={endValidation?.error}
                    warning={endValidation?.warning}
                    validationText={endValidation?.validationText}
                    date={canonicalDateToCalendarInput(
                        end,
                        calendarContext.dateFormat
                    )}
                    inputWidth="100%"
                    width="min(320px, calc(100vw - 64px))"
                    onDateSelect={(payload) =>
                        handleSelection(payload, start, 'end')
                    }
                />
                {end && clearButton('end')}
            </div>
        </div>
    )
}

interface ProgramStageControlProps {
    program: TrackerProgram
    selectedStageId?: string
    defaultOpen?: boolean
    onChange: (stageId?: string) => void
    onRemove: () => void
}

export const ProgramStageControl = ({
    program,
    selectedStageId,
    defaultOpen,
    onChange,
    onRemove,
}: ProgramStageControlProps) => {
    const i18n = { t: useWorkingListText() }
    const [buttonElement, setButtonElement] =
        useState<HTMLButtonElement | null>(null)
    const editorRef = useRef<HTMLFormElement>(null)
    const [open, setOpen] = useState(defaultOpen ?? false)
    const [draft, setDraft] = useState(selectedStageId ?? '')
    const stages = useMemo(
        () =>
            program.programStages.filter(
                (stage) => stage.access?.read !== false
            ),
        [program.programStages]
    )
    const selectedName = stages.find(
        (stage) => stage.id === selectedStageId
    )?.displayName

    const close = () => {
        setOpen(false)
        requestAnimationFrame(() => buttonElement?.focus())
    }
    useEscapeToClose(open, close)
    useEffect(() => {
        if (!open) {
            return
        }
        const frame = requestAnimationFrame(() => {
            editorRef.current
                ?.querySelector<HTMLElement>(
                    'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
                ?.focus()
        })
        return () => cancelAnimationFrame(frame)
    }, [open])

    return (
        <div className={styles['filter-control']}>
            <button
                ref={setButtonElement}
                type="button"
                className={`${styles['filter-button']}${
                    selectedStageId ? ` ${styles['filter-button--active']}` : ''
                }`}
                data-testid="filter-programStage"
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => {
                    setDraft(selectedStageId ?? '')
                    setOpen((value) => !value)
                }}
            >
                <span>
                    {selectedName
                        ? i18n.t('{{filterName}}{{escape}}', {
                              filterName: i18n.t('Program stage'),
                              escape: ':',
                          })
                        : i18n.t('Program stage')}
                </span>
                {selectedName && <strong>{selectedName}</strong>}
                <span aria-hidden="true">▾</span>
            </button>
            {open && buttonElement && (
                <Popover
                    arrow={false}
                    maxWidth={400}
                    placement="bottom-start"
                    reference={buttonElement}
                    onClickOutside={close}
                >
                    <div className={styles['filter-popover-sheet']}>
                        <form
                            ref={editorRef}
                            className={styles['filter-editor']}
                            data-testid="filter-editor-programStage"
                            role="dialog"
                            aria-label={i18n.t('Program stage')}
                            onSubmit={(event) => {
                                event.preventDefault()
                                if (!draft) {
                                    return
                                }
                                onChange(draft)
                                close()
                            }}
                        >
                            <h3>{i18n.t('Program stage')}</h3>
                            <SingleSelectField
                                dense
                                dataTest="filter-value-programStage"
                                label={i18n.t('Stage')}
                                selected={draft}
                                onChange={({ selected }) => setDraft(selected)}
                            >
                                {stages.map((stage) => (
                                    <SingleSelectOption
                                        key={stage.id}
                                        value={stage.id}
                                        label={stage.displayName}
                                    />
                                ))}
                            </SingleSelectField>
                            <div className={styles['filter-editor__actions']}>
                                <Button
                                    primary
                                    small
                                    type="submit"
                                    dataTest="filter-update-programStage"
                                    disabled={!draft}
                                >
                                    {i18n.t('Update')}
                                </Button>
                                <Button
                                    small
                                    type="button"
                                    dataTest="filter-reset-programStage"
                                    onClick={() => {
                                        onChange(undefined)
                                        close()
                                    }}
                                >
                                    {i18n.t('Reset filter')}
                                </Button>
                                <Button
                                    destructive
                                    small
                                    type="button"
                                    dataTest="filter-remove-programStage"
                                    onClick={() => {
                                        onRemove()
                                        close()
                                    }}
                                >
                                    {i18n.t('Remove filter')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </Popover>
            )}
        </div>
    )
}
