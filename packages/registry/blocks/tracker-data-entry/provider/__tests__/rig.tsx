import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import { useContext } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import type { Field } from '@/components/dhis2-value-types'
import { cleanup, render } from 'vitest-browser-react'
import type { StoreApi } from 'zustand/vanilla'
import type { CellOverrides, CellKey, GridRow } from '@/components/spreadsheet'
import { SpreadsheetGrid, cellKey } from '@/components/spreadsheet'
import { control } from '@/components/spreadsheet/grid/__tests__/gridRig'
import { useSpreadsheetContext } from '@/components/spreadsheet/provider/context'
import type { SpreadsheetContext } from '@/components/spreadsheet/provider/context'
import type { TrackerEffectsState } from '../../logic/effects'
import type {
    DataRecord,
    EventStatus,
    PendingChange,
    TrackerColumn,
} from '../../model/types'
import { openOutbox, outboxName } from '../../outbox/outbox'
import type { Outbox, OutboxRecord } from '../../outbox/outbox'
import type { TrackerDataEntrySource, LoadedForm } from '../../sources/types'
import { paintClock } from '../afterPaint'
import { TrackerDataEntry } from '../TrackerDataEntry'
import { TrackerDataEntryViewContext, TrackerReactContext } from '../hooks'
import type { TrackerDataEntryView, TrackerContext } from '../hooks'

/** The spreadsheet's context as `TrackerDataEntry` fills it: its annotations are the form's own effects store. */
type FormContext = Omit<SpreadsheetContext, 'effects'> & {
    effects: StoreApi<TrackerEffectsState>
}

export const USER = 'userA'
export const KEY = 'memory:visits'
const STAGE = 's1'
const ORG_UNIT = 'o1'
/** A field of the stage no column shows. */
export const HIDDEN_FIELD = 'hiddenField'

const COLUMNS: TrackerColumn[] = [
    { id: 'c1', label: 'Children', field: { valueType: 'INTEGER' } },
    {
        id: 'c2',
        label: 'Referral',
        field: {
            valueType: 'TEXT',
            options: [
                { code: 'A', name: 'Alpha' },
                { code: 'B', name: 'Bravo' },
                { code: 'C', name: 'Charlie' },
            ],
        },
    },
    { id: 'c3', label: 'Notes', field: { valueType: 'TEXT' } },
]

/** A row of the visits table, with the status of the event it saves to. */
interface Visit extends GridRow {
    status: EventStatus
}

export const visit = (
    id: string,
    label: string,
    status: EventStatus = 'ACTIVE'
): Visit => ({ id, label, status })

interface FormOptions {
    rows?: Visit[]
    values?: Array<[CellKey, string]>
    readOnlyRecords?: Array<[string, string]>
    canReopen?: string[]
    /** Stage `s1` blocks entry once completed, with this reason. */
    blockedWhenCompleted?: string
    hasMore?: boolean
}

export const BLOCKED = 'Completed events in this stage cannot be edited'

/** One table of visits: Children (required), Referral (options A, B, C) and Notes, which the stage has no field for. */
export const visitForm = ({
    rows = [visit('r1', 'Visit 1'), visit('r2', 'Visit 2')],
    values = [],
    readOnlyRecords = [],
    canReopen = [],
    blockedWhenCompleted,
    hasMore = false,
}: FormOptions = {}): LoadedForm => ({
    tables: [
        {
            id: 't1',
            title: 'Visits',
            rows: rows.map(({ id, label }) => ({ id, label })),
            columns: COLUMNS,
            headerRows: [
                COLUMNS.map(({ id, label }) => ({ id, label, span: 1 })),
            ],
            closed: new Map(),
        },
    ],
    values: new Map(values),
    records: new Map(
        rows.map(({ id, status }) => [
            id,
            {
                kind: 'event',
                id,
                programStageId: STAGE,
                orgUnitId: ORG_UNIT,
                status,
            },
        ])
    ),
    fields: new Map([
        ...COLUMNS.map(({ id, field }): [string, Field] => [id, field]),
        [HIDDEN_FIELD, { valueType: 'INTEGER' }],
    ]),
    // Notes is another stage's field; the hidden one is the stage's, with no column.
    fieldsByForm: new Map([[STAGE, new Set(['c1', 'c2', HIDDEN_FIELD])]]),
    required: new Map([[STAGE, new Set(['c1'])]]),
    strategy: new Map([[STAGE, 'ON_COMPLETE']]),
    sections: new Map(),
    readOnlyRecords: new Map(readOnlyRecords),
    canReopen: new Set(canReopen),
    readOnlyWhenCompleted: new Map(
        blockedWhenCompleted === undefined
            ? []
            : [[STAGE, blockedWhenCompleted]]
    ),
    mayUncomplete: true,
    newRows: {
        tableId: 't1',
        programStageId: STAGE,
        orgUnitId: ORG_UNIT,
    },
    orgUnitNames: new Map(),
    fileNames: new Map(),
    hasMore,
    fieldNames: new Map(),
})

// Gates still closed when a test ends are opened, so no sync loop keeps its lock.
const gates: Array<() => void> = []

/**
 * A source kept in memory: every save is recorded and saved, unless `hold` keeps the next ones waiting until
 * `release`, or `fail` makes them throw as a dropped connection does.
 */
export const memorySource = (form: LoadedForm, key = KEY) => {
    const sent: OutboxRecord[][] = []
    const statuses: Array<[string, string]> = []
    let loads = 0
    let gate = Promise.resolve()
    let failing = false
    const source: TrackerDataEntrySource = {
        key,
        load: async () => {
            loads += 1
            return form
        },
        save: async (_engine, records) => {
            sent.push([...records])
            if (failing) {
                throw new Error('The connection dropped')
            }
            await gate
            return records.map(({ sourceKey, key: saved }) => ({
                sourceKey,
                key: saved,
                result: 'saved',
            }))
        },
        setStatus: async (_engine, rowId, status) => {
            statuses.push([rowId, status])
            return [
                {
                    sourceKey: key,
                    key: cellKey(rowId, 'status'),
                    result: 'saved',
                },
            ]
        },
        // Only the new rows this form adds: same stage and org unit.
        restoreRows: async (_engine, records, { newRows }) => {
            const restored = new Map<string, DataRecord>()
            for (const { record } of records) {
                if (
                    record?.kind === 'event' &&
                    record.isNew &&
                    record.programStageId === newRows?.programStageId &&
                    record.orgUnitId === newRows.orgUnitId
                ) {
                    restored.set(record.id, record)
                }
            }
            return {
                rows: [...restored.keys()].map((id) => ({
                    id,
                    label: 'New event',
                })),
                records: [...restored.values()],
            }
        },
    }
    return {
        source,
        sent,
        statuses,
        /** How often the form was loaded. */
        loads: () => loads,
        hold() {
            gate = new Promise((resolve) => gates.push(resolve))
        },
        release() {
            gates.splice(0).forEach((open) => open())
        },
        fail() {
            failing = true
        },
    }
}

const servers: string[] = []

/** A server URL no other test uses, so each test has its own outbox and sync lock. */
export const freshServer = () => {
    const server = `https://${crypto.randomUUID()}.example.org`
    servers.push(server)
    return server
}

const deleteDatabase = (name: string) =>
    new Promise<void>((resolve, reject) => {
        const deleting = indexedDB.deleteDatabase(name)
        deleting.onsuccess = () => resolve()
        deleting.onerror = () => reject(deleting.error)
    })

/** Run after each test: unmounts, opens every gate, restores spies and deletes the outboxes. */
export const cleanUp = async () => {
    await cleanup()
    gates.splice(0).forEach((open) => open())
    vi.restoreAllMocks()
    // A test that went offline leaves React Query's online manager, shared by every test, offline.
    onlineManager.setOnline(true)
    await Promise.all(
        servers
            .splice(0)
            .map((server) => deleteDatabase(outboxName(server, USER)))
    )
}

/** Works on the server's outbox as another tab would, then closes it. */
export const withOutbox = async <T,>(
    server: string,
    work: (outbox: Outbox) => Promise<T>
) => {
    const outbox = await openOutbox(server, USER)
    try {
        return await work(outbox)
    } finally {
        outbox.close()
    }
}

export const records = (server: string, sourceKey?: string) =>
    withOutbox(server, (outbox) => outbox.list(sourceKey))

export const change = (
    key: CellKey,
    value: string,
    overrides: Partial<PendingChange> = {}
): PendingChange => ({
    sourceKey: KEY,
    key,
    value,
    base: null,
    at: 1,
    ...overrides,
})

interface MountOptions {
    server?: string
    /** The app's React Query client; a fresh one by default. */
    client?: QueryClient
    cells?: CellOverrides
    children?: ReactNode
    /** Who the server says is signed in, asked on every request; an error is thrown as the server's answer. */
    signedIn?: () => string | Error
    /** More resources the fake server answers, such as a program's rules. */
    data?: ComponentProps<typeof CustomDataProvider>['data']
    /** How many `TrackerDataEntry`s of the source the page shows, side by side; the last one is read. */
    copies?: number
    /** Forms of other sources the page shows after those, each with the same children; none is read. */
    after?: ReadonlyArray<TrackerDataEntrySource>
    /** The status the form is waiting for before `mount` resolves. */
    until?: TrackerDataEntryView['status']
}

/** `TrackerDataEntry` over the source, with the grid unless other children are given; resolves once it is ready. */
export const mount = async (
    source: TrackerDataEntrySource,
    {
        server = freshServer(),
        client = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        }),
        cells,
        children = <SpreadsheetGrid />,
        signedIn = () => USER,
        data: more = {},
        copies = 1,
        after = [],
        until = 'ready',
    }: MountOptions = {}
) => {
    // The abort signal of every `me` request, in order.
    const meSignals: Array<AbortSignal | undefined> = []
    const data = {
        me: async (_type, _query, options) => {
            meSignals.push(options?.signal)
            const who = signedIn()
            if (who instanceof Error) {
                throw who
            }
            return { id: who }
        },
        'system/info': { calendar: 'iso8601', dateFormat: 'yyyy-mm-dd' },
        ...more,
    } satisfies ComponentProps<typeof CustomDataProvider>['data']
    let context: FormContext | undefined
    let view: StoreApi<TrackerDataEntryView> | undefined
    let tracker: TrackerContext | undefined
    const Grab = () => {
        // SAFETY: TrackerDataEntry hands the spreadsheet its form's own effects store, which tests may write.
        context = useSpreadsheetContext() as FormContext
        view = useContext(TrackerDataEntryViewContext)
        tracker = useContext(TrackerReactContext)
        return null
    }
    const tree = () => (
        <Provider
            config={{ baseUrl: server, apiVersion: 42 }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={undefined}
            showAlertsInPlugin={false}
        >
            <CustomDataProvider data={data}>
                <QueryClientProvider client={client}>
                    {Array.from({ length: copies }, (_, copy) => (
                        <TrackerDataEntry
                            key={copy}
                            source={source}
                            cells={cells}
                        >
                            {children}
                            <Grab />
                        </TrackerDataEntry>
                    ))}
                    {after.map((other) => (
                        <TrackerDataEntry
                            key={other.key}
                            source={other}
                            cells={cells}
                        >
                            {children}
                        </TrackerDataEntry>
                    ))}
                </QueryClientProvider>
            </CustomDataProvider>
        </Provider>
    )
    const screen = await render(tree())
    await expect.poll(() => view?.getState().status).toBe(until)
    const got = <T,>(value: T | undefined) => {
        if (value === undefined) {
            throw new Error('TrackerDataEntry did not render its children')
        }
        return value
    }
    return {
        server,
        screen,
        /** Renders the page again from its root, as an app's own state change does; the data provider makes a new engine. */
        rerender: () => screen.rerender(tree()),
        client,
        meSignals,
        context: () => got(context),
        tracker: () => got(tracker),
        view: () => got(view).getState(),
    }
}

/** What a cell's control says besides its value, one note per entry. */
export const notesOf = (key: CellKey) =>
    (control(key).getAttribute('aria-describedby') ?? '')
        .split(' ')
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')

export const later = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Whether leaving the page now would ask first. */
export const leaving = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
}

/** Stops downloads and collects the files they would have saved. */
export const catchDownloads = () => {
    const files: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((file) => {
        if (file instanceof Blob) {
            files.push(file)
        }
        return 'blob:unsent'
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    return files
}

/** Holds idle callbacks: `next` runs the first one, `run` runs them and those they ask for. */
export const holdIdle = () => {
    const waiting: IdleRequestCallback[] = []
    vi.spyOn(window, 'requestIdleCallback').mockImplementation((callback) =>
        waiting.push(callback)
    )
    const next = () =>
        waiting.shift()?.({ didTimeout: false, timeRemaining: () => 50 })
    return {
        next,
        run() {
            while (waiting.length > 0) {
                next()
            }
        },
    }
}

/** Holds the paint that deferred work waits for: `run` lets it happen, and runs what waited. */
export const holdPaint = () => {
    const waiting: Array<() => void> = []
    vi.spyOn(paintClock, 'wait').mockImplementation((next) => {
        waiting.push(next)
        return () => {
            const at = waiting.indexOf(next)
            if (at >= 0) {
                waiting.splice(at, 1)
            }
        }
    })
    return {
        run() {
            while (waiting.length > 0) {
                waiting.shift()?.()
            }
        },
    }
}
