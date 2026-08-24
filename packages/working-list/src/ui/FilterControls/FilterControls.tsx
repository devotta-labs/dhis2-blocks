import {
    Box,
    Button,
    CalendarInput,
    Checkbox,
    Field,
    Menu,
    MenuDivider,
    MenuItem,
    MultiSelect,
    MultiSelectField,
    MultiSelectOption,
    OrganisationUnitTree,
    Popover,
    SingleSelect,
    SingleSelectField,
    SingleSelectOption,
    Tooltip,
} from '@dhis2/ui'
import { IconCross16, IconFilter16 } from '@dhis2/ui-icons'
import { useQuery } from '@tanstack/react-query'
import React, {
    createContext,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react'
import { z } from 'zod'
import type { WorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import type { TrackerProgram } from '../../api/schemas'
import type {
    WorkingListCalendar,
    WorkingListDateFormat,
} from '../../api/systemInfo'
import {
    FILTER_OPERATORS,
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
export type StrictCalendarInputProps = React.ComponentProps<
    typeof CalendarInput
> & {
    strictValidation?: boolean
}

interface FilterControlsComponents {
    CalendarInput: React.ComponentType<StrictCalendarInputProps>
    Popover: React.ComponentType<React.ComponentProps<typeof Popover>>
}

const FilterControlsComponentsContext = createContext<FilterControlsComponents>(
    { CalendarInput, Popover }
)

export const FilterControlsComponentProvider = ({
    components,
    children,
}: {
    components: FilterControlsComponents
    children: React.ReactNode
}) => (
    <FilterControlsComponentsContext.Provider value={components}>
        {children}
    </FilterControlsComponentsContext.Provider>
)

const StrictCalendarInput = (props: StrictCalendarInputProps) => {
    const { CalendarInput: CalendarInputComponent } = useContext(
        FilterControlsComponentsContext
    )
    return <CalendarInputComponent {...props} />
}

const FilterPopover = (props: React.ComponentProps<typeof Popover>) => {
    const { Popover: PopoverComponent } = useContext(
        FilterControlsComponentsContext
    )
    return <PopoverComponent {...props} />
}

const focusFirstControl = (element: HTMLElement | null) => {
    if (!element) {
        return
    }
    requestAnimationFrame(() =>
        element
            .querySelector<HTMLElement>(
                'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            ?.focus()
    )
}

const focusFirstAvailableFilter = (element: HTMLElement | null) => {
    if (!element) {
        return
    }
    requestAnimationFrame(() =>
        element
            .querySelector<HTMLElement>('[data-test^="add-filter-"]')
            ?.focus()
    )
}

const configureFilterCombobox = (
    root: HTMLElement | null,
    selector: string,
    open: boolean,
    controls: string,
    label: string,
    clearSelector: string,
    clearLabel: string
) => {
    const combobox = root?.querySelector<HTMLElement>(selector)
    combobox?.setAttribute('role', 'combobox')
    combobox?.setAttribute('aria-expanded', String(open))
    combobox?.setAttribute('aria-haspopup', 'dialog')
    combobox?.setAttribute('aria-controls', controls)
    combobox?.setAttribute('aria-label', label)
    root?.querySelector<HTMLElement>(clearSelector)?.setAttribute(
        'aria-label',
        clearLabel
    )
}

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
    const labels = new Map([
        ['enrollmentStatus', translate('Enrollment status')],
        ['enrolledAt', translate('Enrollment date')],
        ['enrollmentOccurredAt', translate('Incident date')],
        ['followUp', translate('Follow up')],
        ['assignedUser', translate('Assigned to')],
        ['eventOccurredAt', translate('Report date')],
        ['eventStatus', translate('Event status')],
        ['eventScheduledAt', translate('Scheduled date')],
        ['eventAssignedUser', translate('Assigned to')],
        ['programStage', translate('Program stage')],
        ['createdAt', translate('Registration date')],
        ['programOwnerId', translate('Owner organisation unit')],
        ['eventOrgUnit', translate('Event organisation unit')],
    ])
    return labels.get(field.id) ?? field.displayName
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
    const [debouncedSearch, setDebouncedSearch] = useState('')
    useEffect(() => {
        const timeout = window.setTimeout(
            () => setDebouncedSearch(search.trim()),
            250
        )
        return () => window.clearTimeout(timeout)
    }, [search])
    const usersQuery = useQuery({
        queryKey: ['working-list', 'users', debouncedSearch],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'users',
                    params: (() => {
                        const params = {
                            fields: 'id,displayName,username',
                            pageSize: 50,
                        }
                        return debouncedSearch
                            ? { ...params, query: debouncedSearch }
                            : params
                    })(),
                },
                UsersResponseSchema,
                signal
            ),
        placeholderData: (previous) => previous,
        staleTime: 60_000,
    })
    const users = usersQuery.data?.users ?? []
    const knownIds = new Set(users.map((user) => user.id))

    return (
        <div
            className={styles['reference-filter-editor']}
            data-testid="assignee-user-selector"
            onChangeCapture={(event) => {
                const target = event.target
                if (
                    target instanceof HTMLInputElement &&
                    target.name === 'filter'
                ) {
                    setSearch(target.value)
                }
            }}
        >
            <Field dataTest="assignee-users" label={i18n.t('Users')}>
                <Box minWidth="100px">
                    <MultiSelect
                        collapseSelectionAfter={1}
                        dense
                        filterable
                        filterPlaceholder={i18n.t('Search users')}
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
                                <MultiSelectOption
                                    key={id}
                                    value={id}
                                    label={id}
                                />
                            ))}
                    </MultiSelect>
                </Box>
            </Field>
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
    program?: TrackerProgram
    selectedStageId?: string
    eventFields?: WorkingListField[]
    disabled?: boolean
    onAdd: (fieldId: string) => void
    onSelectStage?: (stageId: string) => void
    onAddStageFilter?: (stageId: string, fieldId: string) => void
}

export const MoreFilters = ({
    fields,
    visibleFilterIds,
    scope,
    program,
    selectedStageId,
    eventFields = [],
    disabled = false,
    onAdd,
    onSelectStage,
    onAddStageFilter,
}: MoreFiltersProps) => {
    const translate = useWorkingListText()
    const i18n = { t: translate }
    const [buttonElement, setButtonElement] = useState<HTMLDivElement | null>(
        null
    )
    const [open, setOpen] = useState(false)
    const [openSubMenu, setOpenSubMenu] = useState<
        'program-stages' | 'stage-fields' | null
    >(null)
    const available = fields.filter(
        (field) => field.filterable && !visibleFilterIds.includes(field.id)
    )
    const stages = useMemo(
        () =>
            program?.programStages.filter(
                (stage) => stage.access?.read !== false
            ) ?? [],
        [program]
    )
    const menuStage = stages.find((stage) => stage.id === selectedStageId)
    const availableStageFields = eventFields.filter(
        (field) =>
            field.filterable &&
            !visibleFilterIds.includes(field.id) &&
            (field.source !== 'eventDataElement' ||
                menuStage?.programStageDataElements.some(
                    (binding) => binding.dataElement.id === field.id
                ))
    )

    const close = () => {
        setOpen(false)
        setOpenSubMenu(null)
        requestAnimationFrame(() =>
            buttonElement?.querySelector<HTMLButtonElement>('button')?.focus()
        )
    }
    useEscapeToClose(open, close)
    if (!available.length && !stages.length && !availableStageFields.length) {
        return null
    }

    return (
        <div ref={setButtonElement} className={styles['more-filters-menu']}>
            <Button
                secondary
                small
                icon={<IconFilter16 />}
                dataTest={`more-filters-${scope}`}
                data-testid={`more-filters-${scope}`}
                disabled={disabled}
                aria-expanded={open && !disabled}
                aria-haspopup="menu"
                onClick={() => {
                    if (!disabled) {
                        setOpen((value) => !value)
                    }
                }}
            >
                {i18n.t('Filter')}
            </Button>
            {open && !disabled && buttonElement && (
                <FilterPopover
                    arrow={false}
                    maxWidth={400}
                    placement="bottom-start"
                    reference={buttonElement}
                    onClickOutside={close}
                >
                    <div
                        ref={focusFirstAvailableFilter}
                        className={styles['menu-popover-sheet']}
                        style={{
                            maxHeight: `max(160px, calc(100vh - ${
                                Math.ceil(
                                    buttonElement.getBoundingClientRect().bottom
                                ) + 16
                            }px))`,
                        }}
                        onMouseOver={(event) => {
                            const target = event.target
                            if (!(target instanceof Element)) {
                                return
                            }
                            if (
                                target.closest(
                                    '[data-test="program-stage-filter-menu"]'
                                )
                            ) {
                                setOpenSubMenu('program-stages')
                            } else if (
                                menuStage &&
                                target.closest(
                                    `[data-test="stage-filter-fields-${menuStage.id}"]`
                                )
                            ) {
                                setOpenSubMenu('stage-fields')
                            } else if (
                                target.closest('[data-test^="add-filter-"]')
                            ) {
                                setOpenSubMenu(null)
                            }
                        }}
                    >
                        <Menu dense dataTest={`more-filters-menu-${scope}`}>
                            {stages.length > 0 && (
                                <MenuItem
                                    dataTest="program-stage-filter-menu"
                                    label={i18n.t('Program stage')}
                                    showSubMenu={
                                        openSubMenu === 'program-stages'
                                    }
                                    toggleSubMenu={() =>
                                        setOpenSubMenu('program-stages')
                                    }
                                >
                                    {stages.map((stage) => {
                                        const disabled =
                                            Boolean(selectedStageId)
                                        const lockMessage = i18n.t(
                                            'Can only filter using one program stage.'
                                        )
                                        const label = disabled ? (
                                            <Tooltip
                                                dataTest={`stage-lock-tooltip-${stage.id}`}
                                                content={lockMessage}
                                                openDelay={200}
                                            >
                                                {({ ref, ...tooltipProps }) => (
                                                    <span
                                                        ref={(element) => {
                                                            if (element) {
                                                                ref.current =
                                                                    element
                                                            }
                                                        }}
                                                        className={
                                                            styles[
                                                                'stage-lock-tooltip-target'
                                                            ]
                                                        }
                                                        tabIndex={0}
                                                        aria-label={`${stage.displayName}. ${lockMessage}`}
                                                        {...tooltipProps}
                                                    >
                                                        {stage.displayName}
                                                    </span>
                                                )}
                                            </Tooltip>
                                        ) : (
                                            stage.displayName
                                        )
                                        return (
                                            <MenuItem
                                                key={stage.id}
                                                dataTest={`select-filter-stage-${stage.id}`}
                                                disabled={disabled}
                                                active={
                                                    stage.id === selectedStageId
                                                }
                                                label={label}
                                                {...(disabled
                                                    ? {
                                                          ariaLabel:
                                                              stage.displayName,
                                                      }
                                                    : {})}
                                                onClick={() => {
                                                    if (!disabled) {
                                                        onSelectStage?.(
                                                            stage.id
                                                        )
                                                        close()
                                                    }
                                                }}
                                            />
                                        )
                                    })}
                                </MenuItem>
                            )}
                            {menuStage && availableStageFields.length > 0 && (
                                <MenuItem
                                    dataTest={`stage-filter-fields-${menuStage.id}`}
                                    label={menuStage.displayName}
                                    showSubMenu={openSubMenu === 'stage-fields'}
                                    toggleSubMenu={() =>
                                        setOpenSubMenu('stage-fields')
                                    }
                                >
                                    {availableStageFields.map((field) => (
                                        <MenuItem
                                            key={field.id}
                                            dataTest={`add-stage-filter-${menuStage.id}-${field.id}`}
                                            label={fieldDisplayName(
                                                field,
                                                translate
                                            )}
                                            onClick={() => {
                                                onAddStageFilter?.(
                                                    menuStage.id,
                                                    field.id
                                                )
                                                close()
                                            }}
                                        />
                                    ))}
                                </MenuItem>
                            )}
                            {stages.length > 0 && available.length > 0 && (
                                <MenuDivider dataTest="filter-scope-divider" />
                            )}
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
                        </Menu>
                    </div>
                </FilterPopover>
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
        payload: z.input<typeof CalendarSelectionSchema>,
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
    disabled?: boolean
    onChange: (stageId?: string) => void
    onRemove: () => void
}

export const ProgramStageControl = ({
    program,
    selectedStageId,
    defaultOpen,
    disabled = false,
    onChange,
    onRemove,
}: ProgramStageControlProps) => {
    const i18n = { t: useWorkingListText() }
    const editorId = useId()
    const [buttonElement, setButtonElement] = useState<HTMLDivElement | null>(
        null
    )
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

    const setEditorOpen = (nextOpen: boolean) => {
        configureFilterCombobox(
            buttonElement,
            '[data-test="filter-programStage-select"] [tabindex]',
            nextOpen,
            editorId,
            i18n.t('Program stage'),
            '[data-test="filter-programStage-select-clear"]',
            i18n.t('Clear {{filter}} filter', {
                filter: i18n.t('Program stage'),
            })
        )
        setOpen(nextOpen)
    }
    const close = () => {
        setEditorOpen(false)
        requestAnimationFrame(() =>
            buttonElement
                ?.querySelector<HTMLElement>(
                    '[data-test="filter-programStage-select"] [tabindex]'
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
                        '[data-test="filter-programStage-select"] [tabindex]',
                        open,
                        editorId,
                        i18n.t('Program stage'),
                        '[data-test="filter-programStage-select-clear"]',
                        i18n.t('Clear {{filter}} filter', {
                            filter: i18n.t('Program stage'),
                        })
                    )
                }
            }}
            className={styles['filter-control']}
            data-testid="filter-programStage"
            onMouseDownCapture={(event) => {
                if (disabled) {
                    return
                }
                const target =
                    event.target instanceof Element ? event.target : null
                if (
                    !target?.closest(
                        '[data-test="filter-programStage-select-clear"]'
                    )
                ) {
                    return
                }
                event.preventDefault()
                event.stopPropagation()
                onRemove()
            }}
            onClickCapture={(event) => {
                if (disabled) {
                    return
                }
                const target =
                    event.target instanceof Element ? event.target : null
                const select = target?.closest(
                    '[data-test="filter-programStage-select"]'
                )
                if (!select && target !== event.currentTarget) {
                    return
                }
                if (
                    target?.closest(
                        '[data-test="filter-programStage-select-clear"]'
                    )
                ) {
                    return
                }
                event.preventDefault()
                event.stopPropagation()
                setDraft(selectedStageId ?? '')
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
                        '[data-test="filter-programStage-select"] [tabindex]'
                    )
                ) {
                    event.preventDefault()
                    event.stopPropagation()
                    setDraft(selectedStageId ?? '')
                    setEditorOpen(true)
                }
            }}
        >
            <SingleSelect
                dense
                clearable
                clearText={i18n.t('Clear filter')}
                dataTest="filter-programStage-select"
                disabled={disabled}
                prefix={i18n.t('{{filterName}}{{escape}}', {
                    filterName: i18n.t('Program stage'),
                    escape: ':',
                })}
                selected={selectedName ? 'current-stage' : undefined}
                onChange={({ selected }) => {
                    if (!selected) {
                        onRemove()
                    }
                }}
            >
                {selectedName && (
                    <SingleSelectOption
                        value="current-stage"
                        label={selectedName}
                    />
                )}
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
                        <form
                            ref={focusFirstControl}
                            id={editorId}
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
                            </div>
                        </form>
                    </div>
                </FilterPopover>
            )}
        </div>
    )
}
