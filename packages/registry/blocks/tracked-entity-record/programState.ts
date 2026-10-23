import type {
    OrgUnitPathsResponse,
    PersonResponse,
    ProgramsResponse,
    TrackedEntityTypeResponse,
    UserScopesResponse,
} from './schemas'
import type {
    AccessLevel,
    AttributeInfo,
    Enrollment,
    FieldInfo,
    Note,
    ProgramAccess,
    ProgramInfo,
    ProgramRecord,
    RelationshipsResult,
    StageInfo,
    TrackerEvent,
} from './types'

// One program's state for one person (spec 7.2-7.5), and the response
// mappings it needs. Pure: every input is an answered request.

/** The user's org unit scopes, as ids. */
export interface UserScopes {
    capture: ReadonlySet<string>
    search: ReadonlySet<string>
}

/** A request that failed with a network, 5xx or response error. */
export interface FailedRequest {
    error: Error
    retry(): void
}

/** Every answer the record is built from. */
export interface RecordSources {
    person: PersonResponse
    programs: ProgramsResponse
    trackedEntityType: TrackedEntityTypeResponse
    /** The provider's `programs` prop: exactly these, in this order. */
    requestedPrograms?: readonly string[]
    /** Loaded only when some program needs an owner check (spec 7.3 case 2). */
    scopes?: UserScopes
    /** Owner org unit id → path, for the same check. */
    ownerPaths?: ReadonlyMap<string, string>
    /** The programs request failed: every program is `error`. */
    programsError?: FailedRequest
    /**
     * The scope or owner path lookup failed: programs that need the owner
     * check (spec 7.3 case 2) are `error`, not `unavailable`.
     */
    scopesError?: FailedRequest
    relationships: RelationshipsResult
}

type ProgramMetadata = ProgramsResponse['programs'][number]
type StageMetadata = ProgramMetadata['programStages'][number]
type FieldMetadata =
    StageMetadata['programStageDataElements'][number]['dataElement']
type AttributeMetadata =
    ProgramMetadata['programTrackedEntityAttributes'][number]['trackedEntityAttribute']
type AttributeValue = PersonResponse['attributes'][number]
type EnrollmentResponse = PersonResponse['enrollments'][number]
type EventResponse = EnrollmentResponse['events'][number]
type NoteResponse = EnrollmentResponse['notes'][number]

export const toUserScopes = (response: UserScopesResponse): UserScopes => ({
    capture: new Set(response.organisationUnits.map(({ id }) => id)),
    search: new Set(response.teiSearchOrganisationUnits.map(({ id }) => id)),
})

export const toOwnerPaths = (
    response: OrgUnitPathsResponse
): Map<string, string> =>
    new Map(response.organisationUnits.map(({ id, path }) => [id, path]))

/**
 * Spec 7.3: an owner is in scope when any org unit on its path is in the
 * scope for the program's access level. OPEN and AUDITED programs may be
 * searched, so the search scope counts; PROTECTED and CLOSED need capture.
 */
export const ownerInUserScope = (
    ownerPath: string,
    accessLevel: AccessLevel,
    scopes: UserScopes
): boolean => {
    const searchable = accessLevel === 'OPEN' || accessLevel === 'AUDITED'
    return ownerPath
        .split('/')
        .some(
            (id) =>
                id !== '' &&
                (scopes.capture.has(id) ||
                    (searchable && scopes.search.has(id)))
        )
}

const sortedUnique = (ids: Iterable<string>) => [...new Set(ids)].sort()

/**
 * The programs whose metadata the record needs: the requested ones, else
 * every program with a visible enrollment or an owner row.
 */
export const programIdsToLoad = (
    person: PersonResponse,
    requestedPrograms?: readonly string[]
): string[] =>
    sortedUnique(
        requestedPrograms ?? [
            ...person.enrollments.map(({ program }) => program),
            ...person.programOwners.map(({ program }) => program),
        ]
    )

const ownerOf = (person: PersonResponse, programId: string) =>
    person.programOwners.find(({ program }) => program === programId)?.orgUnit

const hasVisibleEnrollment = (person: PersonResponse, programId: string) =>
    person.enrollments.some(({ program }) => program === programId)

type UsableMetadata =
    | { usable: true; metadata: ProgramMetadata }
    | { usable: false; debug: string }

/**
 * Spec 7.2 cases 1-3: the program's metadata, if the person's enrollments in
 * it can be shown at all; else why not.
 */
const usableMetadata = (
    programId: string,
    programs: ProgramsResponse,
    person: PersonResponse
): UsableMetadata => {
    const metadata = programs.programs.find(({ id }) => id === programId)
    if (!metadata) {
        return {
            usable: false,
            debug: `Program ${programId} was not returned: it does not exist or the user cannot read its metadata.`,
        }
    }
    if (!metadata.access.data.read) {
        return {
            usable: false,
            debug: `The user cannot read data of program ${programId}.`,
        }
    }
    if (metadata.programType !== 'WITH_REGISTRATION') {
        return {
            usable: false,
            debug: `Program ${programId} is not a tracker program (${metadata.programType}).`,
        }
    }
    if (metadata.trackedEntityType?.id !== person.trackedEntityType) {
        return {
            usable: false,
            debug: `Program ${programId} is for tracked entity type ${metadata.trackedEntityType?.id ?? 'none'}, not ${person.trackedEntityType}.`,
        }
    }
    return { usable: true, metadata }
}

/**
 * The owner org units to look up for spec 7.3 case 2: programs that would be
 * readable, of the person's type, with an owner row and no visible enrollment.
 * Empty means the scope lookups are not needed.
 */
export const ownerOrgUnitsToCheck = (
    person: PersonResponse,
    programs: ProgramsResponse,
    requestedPrograms?: readonly string[]
): string[] =>
    sortedUnique(
        programIdsToLoad(person, requestedPrograms).flatMap((programId) => {
            const owner = ownerOf(person, programId)
            const needsCheck =
                owner !== undefined &&
                !hasVisibleEnrollment(person, programId) &&
                usableMetadata(programId, programs, person).usable
            return needsCheck ? [owner] : []
        })
    )

// Response → record mappings

/** Spec: empty values arrive with no `value` key, or as "": both are left out. */
const hasValue = (value: string | undefined): value is string =>
    value !== undefined && value !== ''

/** attribute → value, without empty values. Later entries win. */
export const attributeValues = (
    values: ReadonlyArray<AttributeValue>
): Map<string, string> => {
    const map = new Map<string, string>()
    for (const { attribute, value } of values) {
        if (hasValue(value)) map.set(attribute, value)
    }
    return map
}

/** The same entries ordered by key, so the order doesn't follow the API's. */
export const sortedByKey = (map: ReadonlyMap<string, string>) =>
    new Map([...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

const dataValues = (event: EventResponse) => {
    const map = new Map<string, string>()
    for (const { dataElement, value } of event.dataValues) {
        if (hasValue(value)) map.set(dataElement, value)
    }
    return sortedByKey(map)
}

const toField = (field: FieldMetadata): FieldInfo => ({
    id: field.id,
    name: field.displayFormName ?? field.displayName,
    shortName: field.displayShortName,
    valueType: field.valueType,
    optionSet: field.optionSet && {
        id: field.optionSet.id,
        options: field.optionSet.options.map(({ code, displayName }) => ({
            code,
            name: displayName,
        })),
    },
})

interface AttributeSettings {
    displayInList: boolean
    mandatory: boolean
    trackedEntityAttribute: AttributeMetadata
}

export const toAttributeInfo = (
    settings: AttributeSettings
): AttributeInfo => ({
    ...toField(settings.trackedEntityAttribute),
    displayInList: settings.displayInList,
    mandatory: settings.mandatory,
    unique: settings.trackedEntityAttribute.unique,
})

const bySortOrder = <T extends { sortOrder: number }>(items: readonly T[]) =>
    [...items].sort((a, b) => a.sortOrder - b.sortOrder)

const toStage = (stage: StageMetadata, access: ProgramAccess): StageInfo => ({
    id: stage.id,
    name: stage.displayName,
    sortOrder: stage.sortOrder,
    repeatable: stage.repeatable,
    autoGenerateEvent: stage.autoGenerateEvent,
    openAfterEnrollment: stage.openAfterEnrollment,
    generatedByEnrollmentDate: stage.generatedByEnrollmentDate,
    reportDateToUse: stage.reportDateToUse,
    minDaysFromStart: stage.minDaysFromStart,
    standardInterval: stage.standardInterval,
    hideDueDate: stage.hideDueDate,
    blockEntryForm: stage.blockEntryForm,
    allowGenerateNextVisit: stage.allowGenerateNextVisit,
    executionDateLabel:
        stage.displayExecutionDateLabel ?? stage.executionDateLabel,
    dueDateLabel: stage.displayDueDateLabel ?? stage.dueDateLabel,
    // Spec 7.4: stage data write ∧ the program's canWrite.
    canWrite: stage.access.data.write && access.canWrite,
    dataElements: new Map(
        bySortOrder(stage.programStageDataElements).map(
            ({ dataElement, displayInReports }) => [
                dataElement.id,
                { ...toField(dataElement), displayInReports },
            ]
        )
    ),
})

const toProgramInfo = (
    metadata: ProgramMetadata,
    access: ProgramAccess,
    owner: string | undefined
): ProgramInfo => ({
    id: metadata.id,
    name: metadata.displayName,
    accessLevel: metadata.accessLevel,
    onlyEnrollOnce: metadata.onlyEnrollOnce,
    displayIncidentDate: metadata.displayIncidentDate,
    selectEnrollmentDatesInFuture: metadata.selectEnrollmentDatesInFuture,
    selectIncidentDatesInFuture: metadata.selectIncidentDatesInFuture,
    enrollmentDateLabel:
        metadata.displayEnrollmentDateLabel ?? metadata.enrollmentDateLabel,
    incidentDateLabel:
        metadata.displayIncidentDateLabel ?? metadata.incidentDateLabel,
    featureType: metadata.featureType,
    completeEventsExpiryDays: metadata.completeEventsExpiryDays,
    expiryDays: metadata.expiryDays,
    expiryPeriodType: metadata.expiryPeriodType,
    owner,
    attributes: bySortOrder(metadata.programTrackedEntityAttributes).map(
        toAttributeInfo
    ),
    // Spec 7.4: readable stages only, in sortOrder.
    stages: bySortOrder(metadata.programStages)
        .filter((stage) => stage.access.data.read)
        .map((stage) => toStage(stage, access)),
})

const toNote = (note: NoteResponse): Note => ({
    note: note.note,
    value: note.value,
    storedAt: note.storedAt,
    storedBy: note.storedBy,
    createdBy: note.createdBy && {
        uid: note.createdBy.uid,
        username: note.createdBy.username,
        displayName: note.createdBy.displayName,
    },
})

const toEvent = (event: EventResponse): TrackerEvent => ({
    event: event.event,
    programStage: event.programStage,
    enrollment: event.enrollment,
    status: event.status,
    occurredAt: event.occurredAt,
    scheduledAt: event.scheduledAt,
    completedAt: event.completedAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    orgUnit: event.orgUnit,
    geometry: event.geometry,
    notes: event.notes.map(toNote),
    dataValues: dataValues(event),
})

/** Descending string order; a missing value sorts last. */
const newestFirst = (a: string | undefined, b: string | undefined) =>
    a === b ? 0 : (a ?? '') < (b ?? '') ? 1 : -1

/** Spec 8: newest first by occurredAt ?? scheduledAt, then createdAt. */
const compareEvents = (a: TrackerEvent, b: TrackerEvent) =>
    newestFirst(a.occurredAt ?? a.scheduledAt, b.occurredAt ?? b.scheduledAt) ||
    newestFirst(a.createdAt, b.createdAt) ||
    newestFirst(a.event, b.event)

/** Spec 8.1: newest enrolledAt first. */
const compareEnrollments = (a: Enrollment, b: Enrollment) =>
    newestFirst(a.enrolledAt, b.enrolledAt) ||
    newestFirst(a.createdAt, b.createdAt) ||
    newestFirst(a.id, b.id)

const toEnrollment = (
    enrollment: EnrollmentResponse,
    program: ProgramInfo
): Enrollment => {
    // 2.41 repeats every attribute of the person on each enrollment, so the
    // program's own attributes are picked by its metadata, in its order.
    const values = attributeValues(enrollment.attributes)
    const attributes = new Map<string, string>()
    for (const { id } of program.attributes) {
        const value = values.get(id)
        if (value !== undefined) attributes.set(id, value)
    }
    // The server leaves out events of unreadable stages; this keeps it so.
    const readableStages = new Set(program.stages.map(({ id }) => id))
    return {
        id: enrollment.enrollment,
        programId: enrollment.program,
        status: enrollment.status,
        orgUnit: enrollment.orgUnit,
        enrolledAt: enrollment.enrolledAt,
        occurredAt: enrollment.occurredAt,
        completedAt: enrollment.completedAt,
        followUp: enrollment.followUp,
        createdAt: enrollment.createdAt,
        updatedAt: enrollment.updatedAt,
        attributes,
        notes: enrollment.notes.map(toNote),
        events: enrollment.events
            .filter(({ programStage }) => readableStages.has(programStage))
            .map(toEvent)
            .sort(compareEvents),
    }
}

/** Spec 7.3 case 2: why a hidden-enrollment owner rules the program out. */
const ownerProblem = (
    programId: string,
    owner: string,
    accessLevel: AccessLevel,
    sources: RecordSources
): string | undefined => {
    const path = sources.ownerPaths?.get(owner)
    if (!sources.scopes || path === undefined) {
        return `Program ${programId} has an owner (${owner}) but no visible enrollment, and the user's scopes or the owner's path were not loaded.`
    }
    if (ownerInUserScope(path, accessLevel, sources.scopes)) {
        return undefined
    }
    const scope =
        accessLevel === 'OPEN' || accessLevel === 'AUDITED'
            ? 'capture or search scope'
            : 'capture scope'
    return `The person is owned at ${owner} for ${accessLevel} program ${programId}, outside the user's ${scope}.`
}

/** One program's state for the person (spec 7.2-7.5). */
export const resolveProgramState = (
    programId: string,
    sources: RecordSources
): ProgramRecord => {
    if (sources.programsError) {
        return {
            status: 'error',
            programId,
            error: sources.programsError.error,
            retry: sources.programsError.retry,
        }
    }
    const { person } = sources
    const found = usableMetadata(programId, sources.programs, person)
    if (!found.usable) {
        return { status: 'unavailable', programId, debug: found.debug }
    }
    const { metadata } = found

    const access: ProgramAccess = {
        canWrite:
            metadata.access.data.write &&
            sources.trackedEntityType.access.data.write &&
            !person.inactive,
    }
    const owner = ownerOf(person, programId)
    const program = toProgramInfo(metadata, access, owner)

    const enrollments = person.enrollments
        .filter((enrollment) => enrollment.program === programId)
        .map((enrollment) => toEnrollment(enrollment, program))
        .sort(compareEnrollments)
    if (enrollments.length > 0) {
        return { status: 'enrolled', program, enrollments, access }
    }

    if (owner !== undefined) {
        if (sources.scopesError) {
            return {
                status: 'error',
                programId,
                error: sources.scopesError.error,
                retry: sources.scopesError.retry,
            }
        }
        const hidden = ownerProblem(
            programId,
            owner,
            metadata.accessLevel,
            sources
        )
        if (hidden !== undefined) {
            return { status: 'unavailable', programId, debug: hidden }
        }
    }
    return { status: 'not-enrolled', program, access }
}
