import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import { parseDateFormat } from '@/components/dhis2-value-types'
import type { CellOverrides } from '../cells/cellProps'
import { summarise } from '../logic/summary'
import type { DataEntrySource, LoadedForm } from '../sources/types'
import {
    createAnnouncer,
    DataEntryReactContext,
    useDataEntryContext,
} from './context'
import type { DataEntryContext } from './context'
import { DataEntryViewContext } from './hooks'
import type { DataEntryView } from './hooks'
import { openForm, summaryOf } from './openForm'
import type { OpenForm } from './openForm'
import { emptyForm, lockedForm } from './standInForms'
import { useLeaveWarning } from './useLeaveWarning'
import { useRuleEffects } from './useRuleEffects'

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

/** A failure's message, for `DataEntryView.error`. */
const reasonOf = (error: Error | null) => error?.message ?? String(error)

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
 * server, one sync loop per browser, the leave-page prompt while anything is unsent, and one polite live region. Once
 * someone else signs in, the form locks until the page is reloaded.
 */
export const DataEntry = ({ source, cells, children }: DataEntryProps) => {
    const engine = useDataEngine()
    const queryClient = useQueryClient()
    // Absolute, so the outbox is named for the server however the app reaches it.
    const serverUrl = new URL(useConfig().baseUrl, window.location.href).href
    const account = useQuery({
        queryKey: ['data-entry', 'account', serverUrl],
        queryFn: async ({ signal }) =>
            accountSchema.parse(await engine.query(ACCOUNT_QUERY, { signal })),
    })
    const cacheKey = source.cacheKey ?? source.key
    const [loaded, setLoaded] = useState<{ form?: LoadedForm; error?: string }>(
        {}
    )
    useEffect(() => {
        let live = true
        // Fetched once per mount and not watched: loading again, as an app-wide invalidation would, replaces the cells
        // under the person's edits.
        queryClient
            .fetchQuery({
                queryKey: ['data-entry', 'form', cacheKey],
                queryFn: ({ signal }) => source.load(engine, signal),
                gcTime: 0,
            })
            .then(
                (form) => live && setLoaded({ form }),
                (error) => live && setLoaded({ error: reasonOf(error) })
            )
        return () => {
            live = false
            setLoaded({})
        }
        // A source with the same keys is the same form.
    }, [queryClient, cacheKey, engine])
    const form = loaded.form
    const orgUnitNames = useMemo(
        () =>
            createStore<{ names: ReadonlyMap<string, string> }>()(() => ({
                names: form?.orgUnitNames ?? new Map(),
            })),
        [form]
    )
    const userId = account.data?.me.id
    // The user this mount opened the form for. Once DHIS2 names someone else, the form stays locked until a reload.
    const [openedFor, setOpenedFor] = useState<string>()
    if (openedFor === undefined && userId !== undefined) {
        setOpenedFor(userId)
    }
    const [locked, setLocked] = useState(false)
    if (
        !locked &&
        openedFor !== undefined &&
        userId !== undefined &&
        userId !== openedFor
    ) {
        setLocked(true)
    }
    const calendar = account.data?.systemInfo.calendar
    const dateFormat = account.data?.systemInfo.dateFormat
    const settings = useMemo(
        () => ({
            calendar: parseDhis2Calendar(calendar),
            dateFormat: parseDateFormat(dateFormat ?? ''),
        }),
        [calendar, dateFormat]
    )

    // Every DOM id of the form starts with it, so two forms on one page never share one.
    const idScope = `data-entry-${useId().replaceAll(':', '')}`
    const [start] = useState(() => performance.now())
    const measured = useRef(false)
    const [announcer] = useState(createAnnouncer)
    const [placeholder] = useState(emptyForm)
    const [view] = useState(() =>
        createStore<DataEntryView>()(() => ({
            status: 'loading',
            tables: [],
            summary: summarise({}, {}, new Map(), []),
            sync: 'idle',
            addRow: placeholder.addRow,
            complete: placeholder.complete,
            reopen: placeholder.reopen,
            downloadUnsent: placeholder.downloadUnsent,
            discardFailed: placeholder.discardFailed,
        }))
    )
    const [opened, setOpened] = useState<OpenForm>()
    // Why opening the loaded form failed.
    const [failed, setFailed] = useState<string>()

    useEffect(() => {
        if (form === undefined || openedFor === undefined || locked) {
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
            userId: openedFor,
            view,
            announce: announcer.announce,
            onSignedInAsOther() {
                setLocked(true)
                // So every grid of this server, and the next mount, learn who is signed in now.
                void queryClient.invalidateQueries({
                    queryKey: ['data-entry', 'account', serverUrl],
                })
            },
        }).then(
            (next) => {
                if (cancelled) {
                    next.close()
                    return
                }
                open = next
                setOpened(next)
            },
            (error) => {
                if (!cancelled) {
                    setFailed(reasonOf(error))
                }
            }
        )
        return () => {
            cancelled = true
            open?.close()
            setOpened(undefined)
            setFailed(undefined)
        }
        // A source with the same keys is the same form: its keys are in the form's query key.
    }, [
        form,
        openedFor,
        locked,
        serverUrl,
        settings,
        engine,
        view,
        announcer,
        queryClient,
    ])

    const lockedView = useMemo(
        () =>
            locked && form !== undefined
                ? lockedForm(form, settings, source.key)
                : undefined,
        [locked, form, settings, source.key]
    )
    const active = lockedView ?? opened ?? placeholder
    const error =
        loaded.error ??
        (account.isLoadingError ? reasonOf(account.error) : undefined) ??
        failed
    const status =
        error !== undefined
            ? 'error'
            : active === placeholder
              ? 'loading'
              : 'ready'
    useEffect(() => {
        view.setState({
            status,
            error,
            addRow: active.addRow,
            complete: active.complete,
            reopen: active.reopen,
            downloadUnsent: active.downloadUnsent,
            discardFailed: active.discardFailed,
        })
    }, [view, status, error, active])
    // Locked, nothing is sent: the form's last sync state no longer applies.
    useEffect(() => {
        if (lockedView !== undefined) {
            view.setState({ sync: 'idle', summary: summaryOf(lockedView) })
        }
    }, [view, lockedView])

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
    useEffect(() => view.setState({ tables }), [view, tables])
    useRuleEffects({
        open: opened,
        form,
        tables,
        settings,
        announce: announcer.announce,
        idScope,
    })
    const context = useMemo(
        (): DataEntryContext => ({
            store: active.store,
            effects: active.effects,
            idScope,
            settings,
            announce: announcer.announce,
            announcements: announcer.announcements,
            tables,
            newRowTables: active.newRowTables,
            addRow: active.addRow,
            overrides: cells,
            orgUnitNames,
        }),
        [active, tables, idScope, settings, announcer, cells, orgUnitNames]
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
