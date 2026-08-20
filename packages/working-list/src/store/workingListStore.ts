import { createStore, type StoreApi } from 'zustand/vanilla'
import type {
    AppliedFilter,
    EventWorkingListCriteria,
    TrackedEntityWorkingListCriteria,
    WorkingListConfiguration,
    WorkingListCriteria,
    WorkingListViewConfiguration,
} from '../domain/model'
import {
    AppliedFilterSchema,
    WorkingListConfigurationSchema,
    WorkingListCriteriaSchema,
    WorkingListViewConfigurationSchema,
} from '../domain/schemas'

export interface SelectedWorkingListIdentity {
    id: string
    resource:
        | 'generatedDefault'
        | 'trackedEntityInstanceFilters'
        | 'programStageWorkingLists'
}

export interface WorkingListStoreState {
    /** Applied filters and result grain. TanStack Table state is intentionally absent. */
    criteria: WorkingListCriteria
    selectedList?: SelectedWorkingListIdentity
    dirty: boolean
    baselineFingerprint?: string
    setCriteria(criteria: WorkingListCriteria): void
    setFilters(filters: AppliedFilter[]): void
    enterEventMode(programStageId: string): void
    leaveEventMode(): void
    selectList(
        identity: SelectedWorkingListIdentity,
        configuration: WorkingListConfiguration
    ): void
    /** Deselects any saved list and resets to the given default configuration. */
    clearSelection(configuration: WorkingListConfiguration): void
    reconcileView(view: WorkingListViewConfiguration): void
    acceptConfiguration(
        configuration: WorkingListConfiguration,
        identity?: SelectedWorkingListIdentity
    ): void
    markDirty(): void
}

export type WorkingListStore = StoreApi<WorkingListStoreState>

const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(canonicalize)
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, entry]) => [key, canonicalize(entry)])
        )
    }
    return value
}

export const getWorkingListFingerprint = (
    configuration: WorkingListConfiguration
) => JSON.stringify(canonicalize(configuration))

export const composeWorkingListConfiguration = (
    criteria: WorkingListCriteria,
    view: WorkingListViewConfiguration
): WorkingListConfiguration => ({ ...criteria, ...view })

const criteriaFromConfiguration = (
    configuration: WorkingListConfiguration
): WorkingListCriteria =>
    configuration.mode === 'event'
        ? {
              mode: configuration.mode,
              programId: configuration.programId,
              programStageId: configuration.programStageId,
              filters: configuration.filters,
          }
        : {
              mode: configuration.mode,
              programId: configuration.programId,
              filters: configuration.filters,
          }

export const createWorkingListStore = (
    initialConfiguration: WorkingListConfiguration,
    initialIdentity?: SelectedWorkingListIdentity
): WorkingListStore => {
    const parsedInitialConfiguration = WorkingListConfigurationSchema.parse(
        initialConfiguration
    ) as WorkingListConfiguration
    const initialFingerprint = getWorkingListFingerprint(
        parsedInitialConfiguration
    )
    return createStore<WorkingListStoreState>((set, get) => ({
        criteria: criteriaFromConfiguration(parsedInitialConfiguration),
        selectedList: initialIdentity,
        dirty: false,
        baselineFingerprint: initialFingerprint,
        setCriteria(criteria) {
            set({
                criteria: WorkingListCriteriaSchema.parse(
                    criteria
                ) as WorkingListCriteria,
                dirty: true,
            })
        },
        setFilters(filters) {
            const parsedFilters = AppliedFilterSchema.array().parse(
                filters
            ) as AppliedFilter[]
            set((state) => ({
                criteria: { ...state.criteria, filters: parsedFilters },
                dirty: true,
            }))
        },
        enterEventMode(programStageId) {
            set((state) => {
                const trackedEntityFilters = state.criteria.filters.filter(
                    (filter) => filter.field.scope === 'trackedEntity'
                )
                const criteria: EventWorkingListCriteria = {
                    mode: 'event',
                    programId: state.criteria.programId,
                    programStageId,
                    filters: trackedEntityFilters,
                }
                return { criteria, dirty: true }
            })
        },
        leaveEventMode() {
            set((state) => {
                const criteria: TrackedEntityWorkingListCriteria = {
                    mode: 'trackedEntity',
                    programId: state.criteria.programId,
                    filters: state.criteria.filters.filter(
                        (filter) => filter.field.scope === 'trackedEntity'
                    ),
                }
                return { criteria, dirty: true }
            })
        },
        selectList(identity, configuration) {
            const parsedConfiguration = WorkingListConfigurationSchema.parse(
                configuration
            ) as WorkingListConfiguration
            set({
                criteria: criteriaFromConfiguration(parsedConfiguration),
                selectedList: identity,
                dirty: false,
                baselineFingerprint:
                    getWorkingListFingerprint(parsedConfiguration),
            })
        },
        clearSelection(configuration) {
            const parsedConfiguration = WorkingListConfigurationSchema.parse(
                configuration
            ) as WorkingListConfiguration
            set({
                criteria: criteriaFromConfiguration(parsedConfiguration),
                selectedList: undefined,
                dirty: false,
                baselineFingerprint:
                    getWorkingListFingerprint(parsedConfiguration),
            })
        },
        reconcileView(view) {
            const state = get()
            const parsedView = WorkingListViewConfigurationSchema.parse(
                view
            ) as WorkingListViewConfiguration
            const candidate = composeWorkingListConfiguration(
                state.criteria,
                parsedView
            )
            set({
                dirty:
                    getWorkingListFingerprint(candidate) !==
                    state.baselineFingerprint,
            })
        },
        acceptConfiguration(configuration, identity) {
            const parsedConfiguration = WorkingListConfigurationSchema.parse(
                configuration
            ) as WorkingListConfiguration
            set({
                criteria: criteriaFromConfiguration(parsedConfiguration),
                selectedList: identity ?? get().selectedList,
                dirty: false,
                baselineFingerprint:
                    getWorkingListFingerprint(parsedConfiguration),
            })
        },
        markDirty() {
            set({ dirty: true })
        },
    }))
}
