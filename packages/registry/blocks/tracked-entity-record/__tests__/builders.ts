import type {
    AttributeInfo,
    Enrollment,
    ProgramAccess,
    ProgramInfo,
    ProgramRecord,
    TrackedEntityRecord,
    TrackerEvent,
} from '../types'

// Hand-built records for the helper tests; each takes only what a test varies.

export const attributeInfo = (
    id: string,
    overrides: Partial<AttributeInfo> = {}
): AttributeInfo => ({
    id,
    name: id,
    valueType: 'TEXT',
    displayInList: false,
    mandatory: false,
    unique: false,
    ...overrides,
})

export const event = (
    id: string,
    overrides: Partial<Omit<TrackerEvent, 'dataValues'>> & {
        dataValues?: Record<string, string>
    } = {}
): TrackerEvent => {
    const { dataValues, ...rest } = overrides
    return {
        event: id,
        programStage: 'stage',
        enrollment: 'enrollment',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000',
        updatedAt: '2026-01-01T00:00:00.000',
        orgUnit: 'orgUnit',
        notes: [],
        dataValues: new Map(Object.entries(dataValues ?? {})),
        ...rest,
    }
}

export const enrollment = (
    id: string,
    overrides: Partial<Enrollment> = {}
): Enrollment => ({
    id,
    programId: 'program',
    status: 'ACTIVE',
    orgUnit: 'orgUnit',
    enrolledAt: '2025-01-01T00:00:00.000',
    followUp: false,
    createdAt: '2025-01-01T00:00:00.000',
    updatedAt: '2025-01-01T00:00:00.000',
    attributes: new Map(),
    notes: [],
    events: [],
    ...overrides,
})

const programInfo = (
    id: string,
    overrides: Partial<ProgramInfo> = {}
): ProgramInfo => ({
    id,
    name: id,
    accessLevel: 'OPEN',
    onlyEnrollOnce: false,
    displayIncidentDate: false,
    selectEnrollmentDatesInFuture: false,
    selectIncidentDatesInFuture: false,
    completeEventsExpiryDays: 0,
    expiryDays: 0,
    attributes: [],
    stages: [],
    ...overrides,
})

const writable: ProgramAccess = { canWrite: true }

export const enrolled = (
    id: string,
    enrollments: Enrollment[],
    overrides: {
        program?: Partial<ProgramInfo>
        access?: ProgramAccess
    } = {}
): ProgramRecord => ({
    status: 'enrolled',
    program: programInfo(id, overrides.program),
    enrollments,
    access: overrides.access ?? writable,
})

export const notEnrolled = (
    id: string,
    overrides: {
        program?: Partial<ProgramInfo>
        access?: ProgramAccess
    } = {}
): ProgramRecord => ({
    status: 'not-enrolled',
    program: programInfo(id, overrides.program),
    access: overrides.access ?? writable,
})

export const record = (
    overrides: {
        inactive?: boolean
        typeAttributes?: AttributeInfo[]
        attributes?: Record<string, string>
        programs?: ProgramRecord[]
    } = {}
): TrackedEntityRecord => ({
    person: {
        id: 'person',
        trackedEntityType: {
            id: 'type',
            name: 'Person',
            access: { read: true, write: true },
            attributes: overrides.typeAttributes ?? [],
        },
        orgUnit: 'orgUnit',
        inactive: overrides.inactive ?? false,
        potentialDuplicate: false,
        createdAt: '2025-01-01T00:00:00.000',
        updatedAt: '2025-01-01T00:00:00.000',
        attributes: new Map(Object.entries(overrides.attributes ?? {})),
    },
    programs: new Map(
        (overrides.programs ?? []).map((program): [string, ProgramRecord] => [
            program.status === 'enrolled' || program.status === 'not-enrolled'
                ? program.program.id
                : program.programId,
            program,
        ])
    ),
    relationships: { status: 'ready', relationships: [] },
})
