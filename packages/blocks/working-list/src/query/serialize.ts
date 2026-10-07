import type { WorkingListCapabilities } from '../api/capabilities'
import type { DataEngineQueryParameters, ResourceRequest } from '../api/client'
import type { TrackerEvent } from '../api/schemas'
import type {
    FieldCatalog,
    WorkingListConfiguration,
    WorkingListContext,
    WorkingListPagination,
} from '../domain/model'
import {
    WorkingListConfigurationSchema,
    WorkingListContextSchema,
    WorkingListPaginationSchema,
} from '../domain/schemas'
import {
    getSystemFilterDefinition,
    validateSystemFilter,
} from '../registry/systemFilters'
import type { FilterSerializationContext } from '../registry/valueTypes'
import {
    getValueTypeDefinition,
    validateAppliedFilter,
} from '../registry/valueTypes'

const TRACKED_ENTITY_LIST_FIELDS =
    'trackedEntity,createdAt,updatedAt,inactive,attributes[attribute,value],programOwners[orgUnit,program]'

const EVENT_LIST_FIELDS =
    'event,status,program,programStage,enrollment,trackedEntity,occurredAt,scheduledAt,createdAt,updatedAt,orgUnit,assignedUser[uid,username,firstName,surname],dataValues[dataElement,value]'

const TRACKED_ENTITY_JOIN_FIELDS =
    'trackedEntity,createdAt,updatedAt,attributes[attribute,value],programOwners[orgUnit],enrollments[enrollment]'

const mergeParameters = (
    target: DataEngineQueryParameters,
    source: DataEngineQueryParameters
) => {
    for (const [key, value] of Object.entries(source)) {
        if (value === undefined) {
            continue
        }

        if (
            target[key] !== undefined &&
            JSON.stringify(target[key]) !== JSON.stringify(value)
        ) {
            throw new Error(`Conflicting system filters both set ${key}`)
        }

        target[key] = value
    }
}

export interface SerializeWorkingListRequestInput {
    context: WorkingListContext
    configuration: WorkingListConfiguration
    pagination: WorkingListPagination
    capabilities: WorkingListCapabilities
    fields: FieldCatalog
    serializationContext?: FilterSerializationContext
    today?: string
}

export const serializeWorkingListRequest = ({
    context,
    configuration: rawConfiguration,
    pagination: rawPagination,
    capabilities,
    fields,
    serializationContext,
    today,
}: SerializeWorkingListRequestInput): ResourceRequest => {
    const configuration = WorkingListConfigurationSchema.parse(rawConfiguration)
    const pagination = WorkingListPaginationSchema.parse(rawPagination)
    const parsedContext = WorkingListContextSchema.parse(context)

    if (parsedContext.programId !== configuration.programId) {
        throw new Error(
            `Working-list context program ${parsedContext.programId} does not match configuration program ${configuration.programId}`
        )
    }

    if (!capabilities.supported) {
        throw new Error(`DHIS2 API ${capabilities.apiVersion} is not supported`)
    }

    const params: DataEngineQueryParameters = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        program: configuration.programId,
        order: `${fields.get(configuration.sort.fieldId)?.apiName ?? configuration.sort.fieldId}:${configuration.sort.direction}`,
    }

    params.orgUnitMode = 'SELECTED'
    params[configuration.mode === 'trackedEntity' ? 'orgUnits' : 'orgUnit'] =
        parsedContext.orgUnitId

    const filters: string[] = []
    const filterAttributes: string[] = []

    for (const filter of configuration.filters) {
        const currentField = fields.get(filter.field.id)

        if (!currentField) {
            throw new Error(`Unknown filter field ${filter.field.id}`)
        }

        if (currentField.source !== filter.field.source) {
            throw new Error(`Filter field ${filter.field.id} changed source`)
        }

        if (
            currentField.valueType !== filter.field.valueType ||
            currentField.scope !== filter.field.scope
        ) {
            throw new Error(
                `Filter field ${filter.field.id} changed definition`
            )
        }

        if (currentField.scope === 'event' && configuration.mode !== 'event') {
            throw new Error(
                `Event field ${currentField.id} cannot filter tracked entities`
            )
        }

        if (
            configuration.mode === 'event' &&
            currentField.source === 'eventDataElement' &&
            !currentField.programStageIds?.includes(
                configuration.programStageId
            )
        ) {
            throw new Error(
                `Event data element ${currentField.id} does not belong to stage ${configuration.programStageId}`
            )
        }

        const currentFilter = { ...filter, field: currentField }

        if (filter.field.source === 'system') {
            const definition = getSystemFilterDefinition(filter.field.id)

            if (!definition) {
                throw new Error(`Unknown system filter ${filter.field.id}`)
            }

            validateSystemFilter(currentFilter)
            mergeParameters(
                params,
                definition.toQueryParameters(
                    currentFilter,
                    capabilities,
                    serializationContext
                )
            )
            continue
        }

        const validated = validateAppliedFilter(
            currentFilter,
            capabilities,
            serializationContext
        )

        const expression = `${validated.field.apiName ?? validated.field.id}:${getValueTypeDefinition(
            validated.field.valueType
        ).serializeQuery(validated, serializationContext)}`

        if (validated.field.source === 'eventDataElement') {
            if (configuration.mode !== 'event') {
                throw new Error(
                    `Event data element ${validated.field.id} cannot filter tracked entities`
                )
            }

            filters.push(expression)
        } else if (configuration.mode === 'event') {
            filterAttributes.push(expression)
        } else {
            filters.push(expression)
        }
    }

    if (filters.length) {
        params.filter = filters
    }

    if (configuration.mode === 'event' && filterAttributes.length) {
        params.filterAttributes = filterAttributes
    }

    if (configuration.mode === 'trackedEntity') {
        params.fields = TRACKED_ENTITY_LIST_FIELDS

        return { resource: 'tracker/trackedEntities', params }
    }

    params.programStage = configuration.programStageId
    params.fields = EVENT_LIST_FIELDS

    if (params.status === 'SCHEDULE' && params.scheduledAfter === undefined) {
        const serverToday = today ?? serializationContext?.today

        if (!serverToday) {
            throw new Error(
                'Scheduled event requests require today in the server time zone'
            )
        }

        params.scheduledAfter = serverToday
    }

    return { resource: 'tracker/events', params }
}

export interface TrackedEntityJoinPlan {
    trackedEntityIds: string[]
    request: ResourceRequest
}

export const planTrackedEntityJoin = ({
    events,
    programId,
    pageSize,
}: {
    events: TrackerEvent[]
    programId: string
    pageSize: number
}): TrackedEntityJoinPlan | null => {
    const trackedEntityIds = [
        ...new Set(
            events
                .map((event) => event.trackedEntity)
                .filter((id): id is string => Boolean(id))
        ),
    ]

    if (!trackedEntityIds.length) {
        return null
    }

    return {
        trackedEntityIds,
        request: {
            resource: 'tracker/trackedEntities',
            params: {
                program: programId,
                pageSize: Math.max(pageSize, trackedEntityIds.length),
                trackedEntities: trackedEntityIds.join(','),
                fields: TRACKED_ENTITY_JOIN_FIELDS,
            },
        },
    }
}

export const DEFAULT_WORKING_LIST_SORT = {
    fieldId: 'createdAt',
    direction: 'desc',
} as const
