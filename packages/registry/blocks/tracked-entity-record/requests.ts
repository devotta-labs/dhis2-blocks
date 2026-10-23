import type { ResourceRequest } from './client'

// The `fields` selections below are the request plan of spec 8.2. They are the
// same strings scripts/e2e/record-tracked-entity-record-fixtures.sh recorded
// the test fixtures with, so the block asks for exactly what the fixtures hold.

const NOTE_FIELDS =
    'note,value,storedAt,storedBy,createdBy[uid,username,displayName]'

const OPTION_SET_FIELDS = 'id,options[code,displayName]'

const EVENT_FIELDS = `event,program,programStage,enrollment,status,occurredAt,scheduledAt,completedAt,createdAt,updatedAt,orgUnit,geometry,dataValues[dataElement,value],notes[${NOTE_FIELDS}]`

const ENROLLMENT_FIELDS = `enrollment,program,status,orgUnit,enrolledAt,occurredAt,completedAt,followUp,createdAt,updatedAt,attributes[attribute,value],notes[${NOTE_FIELDS}],events[${EVENT_FIELDS}]`

// Request 1: the person, every enrollment and event the user may read. Made
// without `program`, so one answer is one consistent snapshot.
const PERSON_FIELDS = `trackedEntity,trackedEntityType,orgUnit,inactive,potentialDuplicate,createdAt,updatedAt,attributes[attribute,value],programOwners[program,orgUnit],enrollments[${ENROLLMENT_FIELDS}]`

const ATTRIBUTE_FIELDS = `id,displayName,displayShortName,displayFormName,valueType,unique,optionSet[${OPTION_SET_FIELDS}]`

const DATA_ELEMENT_FIELDS = `id,displayName,displayShortName,displayFormName,valueType,optionSet[${OPTION_SET_FIELDS}]`

const STAGE_FIELDS = `id,displayName,sortOrder,repeatable,autoGenerateEvent,openAfterEnrollment,generatedByEnrollmentDate,reportDateToUse,minDaysFromStart,standardInterval,hideDueDate,blockEntryForm,allowGenerateNextVisit,executionDateLabel,displayExecutionDateLabel,dueDateLabel,displayDueDateLabel,access[data[read,write]],programStageDataElements[displayInReports,sortOrder,dataElement[${DATA_ELEMENT_FIELDS}]]`

// Request 2: program metadata.
const PROGRAM_FIELDS = `id,displayName,programType,accessLevel,onlyEnrollOnce,displayIncidentDate,selectEnrollmentDatesInFuture,selectIncidentDatesInFuture,enrollmentDateLabel,displayEnrollmentDateLabel,incidentDateLabel,displayIncidentDateLabel,featureType,completeEventsExpiryDays,expiryDays,expiryPeriodType,access[data[read,write]],trackedEntityType[id],programTrackedEntityAttributes[displayInList,mandatory,sortOrder,trackedEntityAttribute[${ATTRIBUTE_FIELDS}]],programStages[${STAGE_FIELDS}]`

// Request 3: the tracked entity type.
const TRACKED_ENTITY_TYPE_FIELDS = `id,displayName,access[data[read,write]],trackedEntityTypeAttributes[displayInList,mandatory,trackedEntityAttribute[${ATTRIBUTE_FIELDS}]]`

// Request 4: relationships of the person, and the relationship types named in them.
const RELATIONSHIP_SIDE_FIELDS =
    'trackedEntity[trackedEntity,attributes[attribute,value]],enrollment[enrollment],event[event]'
const RELATIONSHIP_FIELDS = `relationship,relationshipType,createdAt,from[${RELATIONSHIP_SIDE_FIELDS}],to[${RELATIONSHIP_SIDE_FIELDS}]`
const RELATIONSHIP_TYPE_FIELDS =
    'id,displayName,fromToName,toFromName,bidirectional'

// Request 5, only when an owned-elsewhere program is found: scopes and paths.
const USER_SCOPE_FIELDS = 'organisationUnits[id],teiSearchOrganisationUnits[id]'
const ORG_UNIT_PATH_FIELDS = 'id,path'

/** `id:in:[a,b]`, with ids sorted so the same set always asks the same thing. */
const idInFilter = (ids: ReadonlyArray<string>) =>
    `id:in:[${[...ids].sort().join(',')}]`

export const personRequest = (id: string): ResourceRequest => ({
    resource: 'tracker/trackedEntities',
    id,
    params: { fields: PERSON_FIELDS },
})

export const programsRequest = (
    ids: ReadonlyArray<string>
): ResourceRequest => ({
    resource: 'programs',
    params: {
        filter: idInFilter(ids),
        paging: false,
        fields: PROGRAM_FIELDS,
    },
})

export const trackedEntityTypeRequest = (id: string): ResourceRequest => ({
    resource: 'trackedEntityTypes',
    id,
    params: { fields: TRACKED_ENTITY_TYPE_FIELDS },
})

export const relationshipsRequest = (id: string): ResourceRequest => ({
    resource: 'tracker/relationships',
    params: {
        trackedEntity: id,
        paging: false,
        fields: RELATIONSHIP_FIELDS,
    },
})

export const relationshipTypesRequest = (
    ids: ReadonlyArray<string>
): ResourceRequest => ({
    resource: 'relationshipTypes',
    params: {
        filter: idInFilter(ids),
        paging: false,
        fields: RELATIONSHIP_TYPE_FIELDS,
    },
})

export const userScopesRequest = (): ResourceRequest => ({
    resource: 'me',
    params: { fields: USER_SCOPE_FIELDS },
})

export const orgUnitPathsRequest = (
    ids: ReadonlyArray<string>
): ResourceRequest => ({
    resource: 'organisationUnits',
    params: {
        filter: idInFilter(ids),
        paging: false,
        fields: ORG_UNIT_PATH_FIELDS,
    },
})
