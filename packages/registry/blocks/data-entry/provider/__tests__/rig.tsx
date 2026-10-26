import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import { useContext } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { cleanup, render } from 'vitest-browser-react'
import type { StoreApi } from 'zustand/vanilla'
import type { CellOverrides } from '../../cells/cellProps'
import { DataGrid } from '../../grid/DataGrid'
import { control } from '../../grid/__tests__/gridRig'
import { cellKey } from '../../model/types'
import type {
    CellKey,
    EventStatus,
    GridColumn,
    GridRow,
    PendingChange,
} from '../../model/types'
import { openOutbox, outboxName } from '../../outbox/outbox'
import type { Outbox, OutboxRecord } from '../../outbox/outbox'
import type { DataEntrySource, LoadedForm } from '../../sources/types'
import { paintClock } from '../afterPaint'
import { useDataEntryContext } from '../context'
import type { DataEntryContext } from '../context'
import { DataEntry } from '../DataEntry'
import { DataEntryViewContext } from '../hooks'
import type { DataEntryView } from '../hooks'

const USER = 'userA'
export const KEY = 'memory:visits'
const STAGE = 's1'
const ORG_UNIT = 'o1'

const COLUMNS: GridColumn[] = [
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

export const visit = (
    id: string,
    label: string,
    status: EventStatus = 'ACTIVE'
): GridRow => ({
    id,
    label,
    programStageId: STAGE,
    orgUnitId: ORG_UNIT,
    status,
})

interface FormOptions {
    rows?: GridRow[]
    values?: Array<[CellKey, string]>
    readOnlyRows?: Array<[string, string]>
    canReopen?: string[]
    /** Stage `s1` blocks entry once completed, with this reason. */
    blockedWhenCompleted?: string
}

export const BLOCKED = 'Completed events in this stage cannot be edited'

/** One table of visits: Children (required), Referral (options A, B, C) and Notes, closed on new rows. */
export const visitForm = ({
    rows = [visit('r1', 'Visit 1'), visit('r2', 'Visit 2')],
    values = [],
    readOnlyRows = [],
    canReopen = [],
    blockedWhenCompleted,
}: FormOptions = {}): LoadedForm => ({
    tables: [
        {
            id: 't1',
            title: 'Visits',
            rows,
            columns: COLUMNS,
            headerRows: [
                COLUMNS.map(({ id, label }) => ({ id, label, span: 1 })),
            ],
            closed: new Map(),
        },
    ],
    values: new Map(values),
    required: new Map([[STAGE, new Set(['c1'])]]),
    strategy: new Map([[STAGE, 'ON_COMPLETE']]),
    sections: new Map(),
    readOnlyRows: new Map(readOnlyRows),
    canReopen: new Set(canReopen),
    closedByStage: new Map([[STAGE, new Set(['c3'])]]),
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
    let gate = Promise.resolve()
    let failing = false
    const source: DataEntrySource = {
        key,
        load: async () => form,
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
        restoreRows: (records) => {
            const rows = new Map<string, GridRow>()
            for (const { key: restored, row } of records) {
                const id = restored.slice(0, restored.indexOf('.'))
                if (row?.isNew) {
                    rows.set(id, {
                        id,
                        label: 'New event',
                        programStageId: row.programStageId,
                        orgUnitId: row.orgUnitId,
                        status: 'ACTIVE',
                        isNew: true,
                    })
                }
            }
            return [...rows.values()]
        },
    }
    return {
        source,
        sent,
        statuses,
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
    cells?: CellOverrides
    children?: ReactNode
    /** Who the server says is signed in, asked on every request; an error is thrown as the server's answer. */
    signedIn?: () => string | Error
    /** More resources the fake server answers, such as a program's rules. */
    data?: ComponentProps<typeof CustomDataProvider>['data']
}

/** `DataEntry` over the source, with the grid unless other children are given; resolves once it is ready. */
export const mount = async (
    source: DataEntrySource,
    {
        server = freshServer(),
        cells,
        children = <DataGrid />,
        signedIn = () => USER,
        data: more = {},
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
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    let context: DataEntryContext | undefined
    let view: StoreApi<DataEntryView> | undefined
    const Grab = () => {
        context = useDataEntryContext()
        view = useContext(DataEntryViewContext)
        return null
    }
    const screen = await render(
        <Provider
            config={{ baseUrl: server, apiVersion: 42 }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={undefined}
            showAlertsInPlugin={false}
        >
            <CustomDataProvider data={data}>
                <QueryClientProvider client={client}>
                    <DataEntry source={source} cells={cells}>
                        {children}
                        <Grab />
                    </DataEntry>
                </QueryClientProvider>
            </CustomDataProvider>
        </Provider>
    )
    await expect.poll(() => view?.getState().status).toBe('ready')
    const got = <T,>(value: T | undefined) => {
        if (value === undefined) {
            throw new Error('DataEntry did not render its children')
        }
        return value
    }
    return {
        server,
        screen,
        meSignals,
        context: () => got(context),
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
