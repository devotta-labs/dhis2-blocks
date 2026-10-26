import { cellKey } from '../../model/types'
import type { PendingRow } from '../../model/types'
import type { OutboxRecord } from '../../outbox/outbox'
import { eventSource } from '../eventSource'
import type { DataEngine, DataEntrySource } from '../types'
import importOneRefused from './fixtures/import-one-refused.json'
import inpatientEvents from './fixtures/inpatient-events.json'
import inpatientProgram from './fixtures/inpatient-program.json'
import meAdmin from './fixtures/me-admin.json'
import rmnchEvents from './fixtures/rmnch-person-events.json'
import rmnchProgram from './fixtures/rmnch-program.json'

const TODAY = '2026-10-26'
export const INPATIENT = 'eBAyeGv0exc'
export const INPATIENT_STAGE = 'Zj7UnCAulEk'
export const NGELEHUN = 'DiszpKrYNg8'
export const RMNCH = 'WSGAb5XwJ3Y'
export const PERSON = 'PE6abx7Zhn0'
export const PERSON_ORG_UNIT = 'm7fBMpmVpSM'
export const SECOND_VISIT = 'edqlbukwRfQ'
export const GESTATIONAL_AGE = 'roKuXYfw1BW'
// Two completed inpatient events: the import fixtures refuse B's age.
export const A = 'NGxc7JpmqqD'
export const B = 'wAiGPfJGMxt'
// Two second visits of the RMNCH person, at 12:05.
export const VISIT = 'yDPqyTvcRpA'
export const LATER_VISIT = 'fwaWno2Vvua'
export const NEW = 'Qa1bC2dE3fG'
export const AGE = 'qrur9Dvnyt5'
export const HEIGHT = 'GieVkTxp4HH'
export const ADMISSION = 'eMyVanycQSC'
export const DISCHARGE = 'msodh3rEMJa'
export const MODE_OF_DISCHARGE = 'fWIAEtYVEGk'
export const DIAGNOSIS = 'K6uUAvq500H'
export const SOURCE = 'events:test'
export const REFUSED_AGE =
    importOneRefused.validationReport.errorReports[0].message

export const NEW_INPATIENT: PendingRow = {
    programStageId: INPATIENT_STAGE,
    orgUnitId: NGELEHUN,
    isNew: true,
}
export const NEW_VISIT: PendingRow = {
    programStageId: SECOND_VISIT,
    orgUnitId: PERSON_ORG_UNIT,
    enrollmentId: PERSON,
    isNew: true,
}

export const INPATIENT_IDS = {
    program: INPATIENT,
    programStage: INPATIENT_STAGE,
    orgUnit: NGELEHUN,
}
/** Event A's own fields as DHIS2 holds them. */
export const EVENT_A = {
    event: A,
    ...INPATIENT_IDS,
    enrollment: 'RiLEKhWHlxZ',
    occurredAt: '2026-12-25T00:00:00.000',
    status: 'COMPLETED',
    attributeOptionCombo: 'HllvX50cXC0',
}

export const INPATIENT_LOAD = {
    program: inpatientProgram,
    events: inpatientEvents,
    me: meAdmin,
}
export const PERSON_LOAD = {
    program: rmnchProgram,
    events: rmnchEvents,
    me: meAdmin,
}

type Query = Parameters<DataEngine['query']>[0]
type QueryOptions = Parameters<DataEngine['query']>[1]
type Mutation = Parameters<DataEngine['mutate']>[0]
type MutateOptions = Parameters<DataEngine['mutate']>[1]
export type Answer = (
    options: MutateOptions
) => ReturnType<DataEngine['mutate']>
/** The events DHIS2 holds, as the read before each import returns them. */
type Server = ReadonlyArray<{ event: string }>

/**
 * DHIS2 for the tests: `loaded` answers the load and `server` the read before each import (whatever ids it asks
 * for, so a test names what DHIS2 holds); `answer` answers each import.
 */
export const fakeEngine = <L>(
    loaded: L,
    server: Server,
    answer: Answer = async () => importOneRefused,
    readTime = 0
) => {
    const reads: Query[] = []
    const mutations: Mutation[] = []
    const readSignals: Array<AbortSignal | undefined> = []
    const signals: Array<AbortSignal | undefined> = []
    // SAFETY: loading and reading call only `query`, saving only `mutate`; both answer from the fixtures.
    const engine = {
        query: async (query: Query, options?: QueryOptions) => {
            if (query.current === undefined) {
                return loaded
            }
            reads.push(query)
            readSignals.push(options?.signal)
            // Like the platform, a read gives up when its signal aborts.
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, readTime)
                options?.signal?.addEventListener('abort', () => {
                    clearTimeout(timer)
                    reject(options.signal?.reason)
                })
            })
            return { current: { events: server } }
        },
        mutate: async (mutation: Mutation, options: MutateOptions) => {
            mutations.push(mutation)
            signals.push(options?.signal)
            return answer(options)
        },
    } as DataEngine
    return { engine, reads, readSignals, mutations, signals }
}

/** A fresh source, loaded, with what it has read and sent so far. */
export const openGrid = async <L>(
    source: DataEntrySource,
    loaded: L,
    server: Server,
    answer?: Answer
) => {
    const fake = fakeEngine(loaded, server, answer)
    const form = await source.load(fake.engine)
    return {
        ...fake,
        form,
        save: (...records: OutboxRecord[]) =>
            source.save(fake.engine, records, form),
        setStatus: (rowId: string, status: 'COMPLETED' | 'ACTIVE') =>
            source.setStatus(fake.engine, rowId, status, form),
        restoreRows: (records: OutboxRecord[]) => source.restoreRows(records),
        sent: () =>
            fake.mutations.flatMap((mutation) =>
                mutation.type === 'delete' ? [] : mutation.data.events
            ),
    }
}

export const inpatientSource = () =>
    eventSource({ programId: INPATIENT, orgUnitId: NGELEHUN, today: TODAY })

/** The inpatient program as the fixtures hold it. */
export const inpatient = (answer?: Answer) =>
    openGrid(inpatientSource(), INPATIENT_LOAD, inpatientEvents.events, answer)

/** One RMNCH person's events, adding second visits. */
export const person = (server: Server = rmnchEvents.events, answer?: Answer) =>
    openGrid(
        eventSource({
            programId: RMNCH,
            orgUnitId: PERSON_ORG_UNIT,
            enrollmentId: PERSON,
            newRowStageId: SECOND_VISIT,
            order: 'occurredAt:asc',
            today: TODAY,
        }),
        PERSON_LOAD,
        server,
        answer
    )

let clock = 0
export const change = (
    rowId: string,
    columnId: string,
    value: string | null,
    row?: PendingRow
): OutboxRecord => ({
    sourceKey: SOURCE,
    key: cellKey(rowId, columnId),
    value,
    base: null,
    at: ++clock,
    state: 'queued',
    row,
})

export const saved = (record: OutboxRecord) => ({
    sourceKey: SOURCE,
    key: record.key,
    result: 'saved',
})

// Shaped like the platform's `FetchError`, whose module cannot load outside a browser.
export const fetchError = <D>(
    type: 'access' | 'unknown',
    message: string,
    details: D
) => Object.assign(new Error(message), { type, details })
