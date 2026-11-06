import type { WorkingListConfiguration } from '../domain/model'
import { formatRepairLocation } from '../domain/repairLocation'
import { validateAppliedFilter } from '../registry/valueTypes'
import type { WorkingListCapabilities } from './capabilities'
import type { SavedDateFilter } from './savedListContracts'
import type { SavedValueFilter } from './schemas'

const SAVED_VALUE_FILTER_KEYS = new Set([
    'attribute',
    'dataItem',
    'eq',
    'sw',
    'ew',
    'like',
    'ge',
    'le',
    'in',
    'null',
    'dateFilter',
])
const DATE_FILTER_KEYS = new Set([
    'type',
    'startDate',
    'endDate',
    'period',
    'startBuffer',
    'endBuffer',
])

export const unknownFields = <Source extends object>(
    source: Source | undefined,
    knownKeys: ReadonlySet<string>
) =>
    source
        ? Object.fromEntries(
              Object.entries(source).filter(([key]) => !knownKeys.has(key))
          )
        : {}

export const replaceSavedFilter = (
    existing: SavedValueFilter,
    next: SavedValueFilter
): SavedValueFilter => ({
    ...unknownFields(existing, SAVED_VALUE_FILTER_KEYS),
    ...next,
})

export const replaceSavedDateFilter = (
    existing: SavedDateFilter | null | undefined,
    next: SavedDateFilter | null | undefined
) =>
    existing && next
        ? { ...unknownFields(existing, DATE_FILTER_KEYS), ...next }
        : next

export const unsupportedFilterIssues = (
    configuration: WorkingListConfiguration,
    capabilities: WorkingListCapabilities
) =>
    configuration.filters.flatMap((filter, index) => {
        try {
            validateAppliedFilter(filter, capabilities)
            return []
        } catch (error) {
            return [
                {
                    kind: 'unsupportedFilter' as const,
                    referenceId: filter.field.id,
                    path: formatRepairLocation({
                        kind: 'filter',
                        collection: 'filters',
                        index,
                    }),
                    message:
                        error instanceof Error
                            ? error.message
                            : `Filter ${filter.field.id} is unsupported`,
                },
            ]
        }
    })
