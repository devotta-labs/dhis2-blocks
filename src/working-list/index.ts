/**
 * Supported package surface. Internal DHIS2 request schemas, query keys,
 * persistence commands, and store implementation deliberately stay private so
 * they can evolve without creating accidental compatibility commitments.
 */
export {
    WorkingList,
    WorkingListQueryBoundary,
    WorkingListTextProvider,
    createWorkingListQueryClient,
} from './ui'
export type {
    WorkingListDataQualityMode,
    WorkingListProps,
    WorkingListQueryBoundaryProps,
    WorkingListTranslate,
    WorkingListTranslationValues,
} from './ui'

export type {
    WorkingListCellValue,
    WorkingListRowIssue,
    WorkingListRowValues,
} from './query/normalizeRows'

export {
    WorkingListBoundaryError,
    createWorkingListClient,
    shouldRetryWorkingListRequest,
} from './api/client'
export type {
    DataEngineLike,
    DataEngineMutation,
    DataEngineQuery,
    DataEngineQueryDefinition,
    DataEngineQueryParameters,
    ResourceRequest,
    WorkingListClient,
} from './api/client'

export {
    detectMetadataFeatures,
    resolveWorkingListCapabilities,
} from './api/capabilities'
export type {
    MetadataFeaturePresence,
    WorkingListCapabilities,
} from './api/capabilities'

export {
    buildProgramFieldCatalog,
    fetchTrackerProgram,
    fetchTrackerPrograms,
} from './api/metadata'
export type { ProgramFieldCatalog } from './api/metadata'

export {
    WORKING_LIST_CALENDARS,
    WorkingListSystemInfoSchema,
    fetchWorkingListSystemInfo,
} from './api/systemInfo'
export type {
    WorkingListCalendar,
    WorkingListDateFormat,
    WorkingListSystemInfo,
} from './api/systemInfo'

export { TrackerProgramSchema } from './api/schemas'
export type { TrackerProgram } from './api/schemas'

export {
    DHIS2_VALUE_TYPES,
    FILTER_OPERATORS,
    FILTER_SOURCES,
    RELATIVE_DATE_PERIODS,
} from './domain/model'
export type {
    AppliedFilter,
    AssigneeFilterValue,
    AssigneeMode,
    BooleanFilterValue,
    DateFilterValue,
    Dhis2ValueType,
    EmptyFilterValue,
    EventWorkingListCriteria,
    FieldCatalog,
    FilterOperator,
    FilterScope,
    FilterSource,
    FilterValue,
    NumberFilterValue,
    OptionFilterValue,
    OrganisationUnitFilterValue,
    RelativeDateFilterValue,
    RelativeDatePeriod,
    TextFilterValue,
    TimeFilterValue,
    TrackedEntityWorkingListCriteria,
    TrueOnlyFilterValue,
    WorkingListConfiguration,
    WorkingListContext,
    WorkingListCriteria,
    WorkingListField,
    WorkingListPagination,
    WorkingListRowOpenEvent,
    WorkingListSort,
    WorkingListViewConfiguration,
} from './domain/model'

export {
    createWorkingListValueTransformers,
    isValidWorkingListClientDate,
} from './registry/transformers'
export type {
    WorkingListTransformerOptions,
    WorkingListValueTransformers,
} from './registry/transformers'

export {
    getAllowedFilterOperators,
    getCellDisplayValue,
    getFilterEditorKind,
    getValueTypeDefinition,
    validateAppliedFilter,
    ValueParseError,
    valueTypeRegistry,
} from './registry/valueTypes'
export type {
    CellDisplayValue,
    CellFormattingContext,
    FilterEditorKind,
    FilterParsingContext,
    FilterSerializationContext,
    ValueTypeDefinition,
} from './registry/valueTypes'
