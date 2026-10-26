import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import { parseDateFormat } from '@/components/dhis2-value-types'
import type { CellOverrides } from '../cells/cellProps'
import { summarise } from '../logic/summary'
import type { DataEntrySource } from '../sources/types'
import {
    createAnnouncer,
    DataEntryReactContext,
    useDataEntryContext,
} from './context'
import type { DataEntryContext } from './context'
import { DataEntryViewContext } from './hooks'
import type { DataEntryView } from './hooks'
import { emptyForm, openForm } from './openForm'
import type { OpenForm } from './openForm'
import { useLeaveWarning } from './useLeaveWarning'

const ACCOUNT_QUERY = {
    me: { resource: 'me', params: { fields: 'id' } },
    systemInfo: {
        resource: 'system/info',
        params: { fields: 'calendar,dateFormat' },
    },
}

const accountSchema = z.object({
    me: z.object({ id: z.string() }),
    systemInfo: z.object({
        calendar: z.string().optional(),
        dateFormat: z.string().optional(),
    }),
})

/** The one polite live region, saying what `announce` was given. */
export const LiveRegion = () => {
    const { announcements } = useDataEntryContext()
    const text = useStore(announcements, (state) => state.text)
    return (
        <div role="status" className="sr-only">
            {text}
        </div>
    )
}

interface DataEntryProps {
    /** Create it once (a module constant, or `useMemo`): a new key or cache key loads the form again. */
    source: DataEntrySource
    /** Controls that replace the default ones; keep the object stable, or every cell renders again. */
    cells?: CellOverrides
    children: ReactNode
}

/**
 * Loads the source's form and keeps it: cells and their effects, unsent changes kept on this device per user and
 * server, one sync loop per browser, the leave-page prompt while anything is unsent, and one polite live region.
 */
export const DataEntry = ({ source, cells, children }: DataEntryProps) => {
    const engine = useDataEngine()
    // Absolute, so the outbox is named for the server however the app reaches it.
    const serverUrl = new URL(useConfig().baseUrl, window.location.href).href
    const account = useQuery({
        queryKey: ['data-entry', 'account', serverUrl],
        queryFn: async ({ signal }) =>
            accountSchema.parse(await engine.query(ACCOUNT_QUERY, { signal })),
        staleTime: Infinity,
    })
    const loaded = useQuery({
        queryKey: ['data-entry', 'form', source.cacheKey ?? source.key],
        queryFn: ({ signal }) => source.load(engine, signal),
        // Loaded once per mount: loading again would replace the cells under the person's edits.
        staleTime: Infinity,
        gcTime: 0,
    })
    const form = loaded.data
    const userId = account.data?.me.id
    const calendar = account.data?.systemInfo.calendar
    const dateFormat = account.data?.systemInfo.dateFormat
    const settings = useMemo(
        () => ({
            calendar: parseDhis2Calendar(calendar),
            dateFormat: parseDateFormat(dateFormat ?? ''),
        }),
        [calendar, dateFormat]
    )

    const [start] = useState(() => performance.now())
    const measured = useRef(false)
    const [announcer] = useState(createAnnouncer)
    const [placeholder] = useState(emptyForm)
    const [view] = useState(() =>
        createStore<DataEntryView>()(() => ({
            status: 'loading',
            summary: summarise({}, {}, new Map(), []),
            sync: 'idle',
            addRow: placeholder.addRow,
            complete: placeholder.complete,
            reopen: placeholder.reopen,
            downloadUnsent: placeholder.downloadUnsent,
        }))
    )
    const [opened, setOpened] = useState<OpenForm>()
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        if (form === undefined || userId === undefined) {
            return
        }
        let cancelled = false
        let open: OpenForm | undefined
        openForm({
            source,
            form,
            engine,
            settings,
            serverUrl,
            userId,
            view,
            announce: announcer.announce,
        }).then(
            (next) => {
                if (cancelled) {
                    next.close()
                    return
                }
                open = next
                setOpened(next)
            },
            () => {
                if (!cancelled) {
                    setFailed(true)
                }
            }
        )
        return () => {
            cancelled = true
            open?.close()
            setOpened(undefined)
            setFailed(false)
        }
        // A source with the same keys is the same form: its keys are in the form's query key.
    }, [form, userId, serverUrl, settings, engine, view, announcer])

    const active = opened ?? placeholder
    const status =
        loaded.isError || account.isError || failed
            ? 'error'
            : opened === undefined
              ? 'loading'
              : 'ready'
    useEffect(() => {
        view.setState({
            status,
            addRow: active.addRow,
            complete: active.complete,
            reopen: active.reopen,
            downloadUnsent: active.downloadUnsent,
        })
    }, [view, status, active])

    useEffect(() => {
        if (opened !== undefined && !measured.current) {
            measured.current = true
            performance.measure('data-entry:ready', { start })
        }
    }, [opened, start])

    // A failed change may be only on this page: the device could not store it.
    useLeaveWarning(
        useStore(view, ({ summary }) => summary.unsent + summary.failed > 0)
    )

    const tables = useStore(active.tables, (state) => state.tables)
    const context = useMemo(
        (): DataEntryContext => ({
            store: active.store,
            effects: active.effects,
            settings,
            announce: announcer.announce,
            announcements: announcer.announcements,
            tables,
            newRowTables: active.newRowTables,
            addRow: active.addRow,
            overrides: cells,
        }),
        [active, tables, settings, announcer, cells]
    )
    return (
        <DataEntryViewContext.Provider value={view}>
            <DataEntryReactContext.Provider value={context}>
                {children}
                <LiveRegion />
            </DataEntryReactContext.Provider>
        </DataEntryViewContext.Provider>
    )
}
