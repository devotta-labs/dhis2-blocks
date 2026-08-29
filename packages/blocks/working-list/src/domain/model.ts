export const DHIS2_VALUE_TYPES = [
    'AGE',
    'BOOLEAN',
    'COORDINATE',
    'DATE',
    'DATETIME',
    'EMAIL',
    'FILE_RESOURCE',
    'GEOJSON',
    'IMAGE',
    'INTEGER',
    'INTEGER_NEGATIVE',
    'INTEGER_POSITIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'LETTER',
    'LONG_TEXT',
    'MULTI_TEXT',
    'NUMBER',
    'ORGANISATION_UNIT',
    'PERCENTAGE',
    'PHONE_NUMBER',
    'REFERENCE',
    'TEXT',
    'TIME',
    'TRACKER_ASSOCIATE',
    'TRUE_ONLY',
    'UNIT_INTERVAL',
    'URL',
    'USERNAME',
] as const

export type Dhis2ValueType = (typeof DHIS2_VALUE_TYPES)[number]

export const FILTER_OPERATORS = [
    'like',
    'startsWith',
    'endsWith',
    'equals',
    'range',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
    'in',
    'empty',
    'notEmpty',
] as const

export type FilterOperator = (typeof FILTER_OPERATORS)[number]

export const FILTER_SOURCES = [
    'trackedEntityAttribute',
    'eventDataElement',
    'system',
] as const

type FilterSource = (typeof FILTER_SOURCES)[number]

export type FilterScope = 'trackedEntity' | 'event'

export interface WorkingListField {
    id: string
    displayName: string
    /** Metadata labels are already localized by DHIS2 and must not be translated. */
    displayNameIsMetadata?: true
    source: FilterSource
    scope: FilterScope
    valueType: Dhis2ValueType
    apiName?: string
    optionSetId?: string
    options?: ReadonlyArray<{ code: string; displayName: string }>
    unique?: boolean
    searchable?: boolean
    filterable: boolean
    /** Whether the field can be selected as a table column in this context. */
    columnable?: boolean
    preferredSearchOperator?: FilterOperator
    blockedSearchOperators?: ReadonlyArray<FilterOperator>
    minCharactersToSearch?: number
    /** Program stages that contain this event data element. */
    programStageIds?: ReadonlyArray<string>
    /** A mandatory tracked-entity attribute; a missing value is a data-quality issue. */
    required?: boolean
    /** Program stages where this event data element is compulsory. */
    requiredInStageIds?: ReadonlyArray<string>
}

type TextFilterValue = {
    kind: 'text'
    value: string
}

type NumberFilterValue = {
    kind: 'numberRange'
    min?: number
    max?: number
}

type TimeFilterValue = {
    kind: 'timeRange'
    min?: string
    max?: string
}

type AbsoluteDateFilterValue = {
    kind: 'dateRange'
    mode: 'absolute'
    start?: string
    end?: string
}

export const RELATIVE_DATE_PERIODS = [
    'TODAY',
    'THIS_WEEK',
    'LAST_WEEK',
    'THIS_MONTH',
    'LAST_MONTH',
    'LAST_3_MONTHS',
    'THIS_YEAR',
] as const

export type RelativeDatePeriod = (typeof RELATIVE_DATE_PERIODS)[number]

type RelativeDateFilterValue = {
    kind: 'dateRange'
    mode: 'relative'
    period?: RelativeDatePeriod
    startBuffer?: number
    endBuffer?: number
}

type DateFilterValue = AbsoluteDateFilterValue | RelativeDateFilterValue

type BooleanFilterValue = {
    kind: 'boolean'
    values: boolean[]
}

type OptionFilterValue = {
    kind: 'options'
    values: string[]
}

type EmptyFilterValue = {
    kind: 'empty'
    isEmpty: boolean
}

type TrueOnlyFilterValue = {
    kind: 'trueOnly'
    value: true
}

type OrganisationUnitFilterValue = {
    kind: 'organisationUnit'
    id: string
}

type AssigneeMode = 'CURRENT' | 'PROVIDED' | 'NONE' | 'ANY'

type AssigneeFilterValue = {
    kind: 'assignee'
    mode: AssigneeMode
    userIds?: string[]
}

export type FilterValue =
    | TextFilterValue
    | NumberFilterValue
    | TimeFilterValue
    | DateFilterValue
    | BooleanFilterValue
    | OptionFilterValue
    | EmptyFilterValue
    | TrueOnlyFilterValue
    | OrganisationUnitFilterValue
    | AssigneeFilterValue

export interface AppliedFilter {
    field: WorkingListField
    operator: FilterOperator
    value: FilterValue
}

export interface WorkingListSort {
    fieldId: string
    direction: 'asc' | 'desc'
}

interface WorkingListViewConfiguration {
    /** Visible column identifiers, in display order. */
    columns: string[]
    /** Capture-compatible single server-side sort. */
    sort: WorkingListSort
}

interface TrackedEntityWorkingListCriteria {
    mode: 'trackedEntity'
    programId: string
    filters: AppliedFilter[]
}

interface EventWorkingListCriteria {
    mode: 'event'
    programId: string
    programStageId: string
    filters: AppliedFilter[]
}

type WorkingListCriteria =
    | TrackedEntityWorkingListCriteria
    | EventWorkingListCriteria

export type WorkingListConfiguration = WorkingListCriteria &
    WorkingListViewConfiguration

export interface WorkingListPagination {
    page: number
    pageSize: number
}

export interface WorkingListContext {
    programId: string
    orgUnitId: string
}

export type FieldCatalog = ReadonlyMap<string, WorkingListField>
