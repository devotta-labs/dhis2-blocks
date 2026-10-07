import type {
    AppliedFilter,
    FilterOperator,
    FilterValue,
    WorkingListField,
} from '../domain/model'
import { getValueTypeDefinition } from '../registry/valueTypes'
import type { FilterParsingContext } from '../registry/valueTypes'
import type { SavedValueFilter } from './schemas'

const getSavedFilterOperator = (
    filter: SavedValueFilter,
    value: FilterValue
): FilterOperator => {
    if (value.kind === 'empty') {
        return value.isEmpty ? 'empty' : 'notEmpty'
    }

    if (
        value.kind === 'dateRange' ||
        value.kind === 'numberRange' ||
        value.kind === 'timeRange'
    ) {
        return 'range'
    }

    if (value.kind === 'options' || value.kind === 'boolean') {
        return 'in'
    }

    if (filter.like != null) {
        return 'like'
    }

    if (filter.sw != null) {
        return 'startsWith'
    }

    if (filter.ew != null) {
        return 'endsWith'
    }

    return 'equals'
}

export const normalizeValueFilter = (
    filter: SavedValueFilter,
    field: WorkingListField,
    parsingContext?: FilterParsingContext
): AppliedFilter => {
    const value = getValueTypeDefinition(field.valueType).parseSaved(
        filter,
        parsingContext
    )

    return {
        field,
        value,
        operator: getSavedFilterOperator(filter, value),
    }
}
