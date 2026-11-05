import { cellKey } from '@/components/spreadsheet'
import type { DataEngine } from '@/components/spreadsheet'
import type {
    DataRecord,
    EnrollmentRecord,
    EventRecord,
    TrackerColumn,
    PersonRecord,
} from '../../model/types'
import type { OutboxRecord } from '../../outbox/outbox'
import { EVENT_DATE_COLUMN } from '../eventSchemas'
import type { LoadedForm } from '../types'

// The RMNCH program on the Sierra Leone demo, as the import fixtures were captured against it.
export const PROGRAM = 'WSGAb5XwJ3Y'
export const PERSON_TYPE = 'nEenWmSyUEp'
export const NGELEHUN = 'DiszpKrYNg8'
export const UNIQUE_ID = 'lZGmxYbs97q'
export const FIRST_NAME = 'w75KJ2mc4zz'
export const LAST_NAME = 'zDhUuAYrxNC'
export const BIRTH_DATE = 'gHGyrwKPzej'
export const CITY = 'FO4sWYJ64LQ'
export const FIRST_VISIT = 'WZbXY0S00lP'
export const SECOND_VISIT = 'edqlbukwRfQ'
const CARE_AT_BIRTH = 'PFDfvmGpsR3'
export const GESTATIONAL_AGE = 'roKuXYfw1BW'
export const DELIVERY_PLACE = 'DelivPlace1'
export const ENROLLED_AT = 'enrolledAt'
export const SOURCE = 'events:WSGAb5XwJ3Y'

const column = (slot: string, field: string, label: string): TrackerColumn => ({
    id: `${slot}:${field}`,
    label,
    field: { valueType: 'TEXT' },
    slot,
    fieldId: field,
})

/** One register row: the person, the enrolment, two visits with dates, and care at birth with no date column. */
const COLUMNS = [
    column('person', UNIQUE_ID, 'Unique ID'),
    column('person', FIRST_NAME, 'First name'),
    column('person', LAST_NAME, 'Last name'),
    column('person', BIRTH_DATE, 'Birth date'),
    column('person', CITY, 'City'),
    column('enrollment', ENROLLED_AT, 'Date of enrolment'),
    column('anc1', EVENT_DATE_COLUMN, 'ANC 1 date'),
    column('anc1', GESTATIONAL_AGE, 'ANC 1 weeks'),
    column('anc2#1', EVENT_DATE_COLUMN, 'ANC 2 date'),
    column('anc2#1', GESTATIONAL_AGE, 'ANC 2 weeks'),
    column('birth', DELIVERY_PLACE, 'Place of birth'),
]

/** The program's mandatory attributes. */
export const MANDATORY = [UNIQUE_ID, FIRST_NAME, LAST_NAME, BIRTH_DATE]

/** A register form holding `records`, whose program requires `mandatory`. */
export const registerForm = (
    records: ReadonlyArray<DataRecord>,
    mandatory: ReadonlyArray<string> = MANDATORY
): LoadedForm => ({
    tables: [
        {
            id: 'register',
            title: 'ANC register',
            rows: [],
            columns: COLUMNS,
            headerRows: [],
            closed: new Map(),
        },
    ],
    values: new Map(),
    records: new Map(records.map((record) => [record.id, record])),
    fields: new Map(),
    fieldsByForm: new Map(),
    required: new Map([
        [PROGRAM, new Set(mandatory)],
        [PERSON_TYPE, new Set()],
    ]),
    strategy: new Map([
        [FIRST_VISIT, 'ON_COMPLETE'],
        [SECOND_VISIT, 'ON_COMPLETE'],
        [CARE_AT_BIRTH, 'ON_COMPLETE'],
    ]),
    sections: new Map(),
    readOnlyRecords: new Map(),
    canReopen: new Set(),
    readOnlyWhenCompleted: new Map(),
    mayUncomplete: false,
    orgUnitNames: new Map(),
    fileNames: new Map(),
    hasMore: false,
    fieldNames: new Map(),
})

/** A new person's row: the person, the enrolment and three slot events, with these ids. */
export const newRow = (ids: {
    person: string
    enrollment: string
    anc1: string
    anc2: string
    birth?: string
}) => {
    const visit = (
        id: string,
        programStageId: string,
        slot: string
    ): EventRecord => ({
        kind: 'event',
        id,
        programStageId,
        orgUnitId: NGELEHUN,
        enrollmentId: ids.enrollment,
        status: 'ACTIVE',
        isNew: true,
        slot,
    })
    const person: PersonRecord = {
        kind: 'trackedEntity',
        id: ids.person,
        trackedEntityTypeId: PERSON_TYPE,
        orgUnitId: NGELEHUN,
        isNew: true,
    }
    const enrollment: EnrollmentRecord = {
        kind: 'enrollment',
        id: ids.enrollment,
        programId: PROGRAM,
        trackedEntityId: ids.person,
        orgUnitId: NGELEHUN,
        status: 'ACTIVE',
        isNew: true,
    }
    return {
        person,
        enrollment,
        anc1: visit(ids.anc1, FIRST_VISIT, 'anc1'),
        anc2: visit(ids.anc2, SECOND_VISIT, 'anc2#1'),
        birth: visit(ids.birth ?? 'EvtBirth001', CARE_AT_BIRTH, 'birth'),
    }
}

export type Row = ReturnType<typeof newRow>

/** The row's records, for the form. */
export const recordsOf = (row: Row): DataRecord[] => Object.values(row)

let clock = 0
/** A change to `field` of `record`, made in the grid, with the record it saves to. */
export const edit = (
    record: DataRecord,
    field: string,
    value: string | null
): OutboxRecord => ({
    sourceKey: SOURCE,
    key: cellKey(record.id, field),
    value,
    base: null,
    at: ++clock,
    state: 'queued',
    record,
})

/** A new person typed in full, with both visits dated, as the import fixtures sent them. */
export const typed = (
    row: Row,
    values: { uniqueId?: string; birthDate?: string } = {}
) => [
    edit(row.person, UNIQUE_ID, values.uniqueId ?? '8350217746'),
    edit(row.person, FIRST_NAME, 'Fatmata'),
    edit(row.person, LAST_NAME, 'Kamara'),
    edit(row.person, BIRTH_DATE, values.birthDate ?? '1990-01-15'),
    edit(row.enrollment, ENROLLED_AT, '2026-10-05'),
    edit(row.anc1, EVENT_DATE_COLUMN, '2026-10-05'),
    edit(row.anc2, EVENT_DATE_COLUMN, '2026-10-20'),
]

/** What DHIS2 holds, by the list a read returns it in. */
export interface Server {
    events?: unknown[]
    enrollments?: unknown[]
    trackedEntities?: unknown[]
}

type Query = Parameters<DataEngine['query']>[0]
type Mutation = Parameters<DataEngine['mutate']>[0]

export const IMPORTED = {
    status: 'OK',
    validationReport: { errorReports: [], warningReports: [] },
}

/**
 * DHIS2 for the tracker saver's tests: each read answers what `server` holds of its kind, whatever ids it asks for;
 * each import answers the next of `answers` (an import with none left is saved whole).
 */
export const trackerEngine = (server: Server, answers: unknown[] = []) => {
    const reads: Array<Query[string]> = []
    const mutations: Mutation[] = []
    // SAFETY: the saver calls only `query` and `mutate`; both answer as DHIS2 would for what it sends.
    const engine = {
        query: async ({ current }: Query) => {
            reads.push(current)
            const list = current.resource.slice('tracker/'.length)
            // SAFETY: the saver reads only `tracker/events`, `tracker/enrollments` and `tracker/trackedEntities`.
            const held = server[list as keyof Server]
            return { current: { [list]: held ?? [] } }
        },
        mutate: async (mutation: Mutation) => {
            mutations.push(mutation)
            return answers.shift() ?? IMPORTED
        },
    } as DataEngine
    /** What each import sent. */
    const sent = () =>
        mutations.map((mutation) =>
            mutation.type === 'delete' ? {} : mutation.data
        )
    return { engine, reads, mutations, sent }
}
