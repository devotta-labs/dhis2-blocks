import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import { parseDateFormat } from '@/components/dhis2-value-types'
import { preloadRuleEngine } from '@/components/program-rules'
import { createAnnouncer, Spreadsheet } from '@/components/spreadsheet'
import type { CellOverrides } from '@/components/spreadsheet'
import { summarise } from '../logic/summary'
import { recordsOf, trackerKeyOf } from '../model/types'
import type { TrackerDataEntrySource, LoadedForm } from '../sources/types'
import { usePages } from './appendPage'
import { EventStatusBadge } from './EventStatusBadge'
import { fileUrlOf } from './fileUrl'
import {
    TrackerDataEntryViewContext,
    reasonOf,
    TrackerReactContext,
} from './hooks'
import type { TrackerDataEntryView, TrackerContext } from './hooks'
import { summaryOf } from './formRows'
import { openForm } from './openForm'
import type { OpenForm } from './openForm'
import { emptyForm, lockedForm } from './standInForms'
import { ShowMoreEvents, ShowMorePeople } from './ShowMore'
import { TrackerRowLabel } from './TrackerRowLabel'
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

interface TrackerDataEntryProps {
    /** Create it once (a module constant, or `useMemo`): a new key or cache key loads the form again. */
    source: TrackerDataEntrySource
    /** Controls that replace the default ones; keep the object stable, or every cell renders again. */
    cells?: CellOverrides
    children: ReactNode
}

/**
 * Loads the source's form and keeps it: cells and their effects, unsent changes kept on this device per user and
 * server, one sync loop per browser, the leave-page prompt while anything is unsent, and one polite live region. Once
 * someone else signs in, the form locks until the page is reloaded.
 */
export const TrackerDataEntry = ({
    source,
    cells,
    children,
}: TrackerDataEntryProps) => {
    const latestEngine = useDataEngine()
    const queryClient = useQueryClient()
    const { baseUrl } = useConfig()
    // Absolute, so the outbox is named for the server however the app reaches it.
    const serverUrl = new URL(baseUrl, window.location.href).href
    // The data provider makes a new engine every render; a new engine for the same server is no reason to reload.
    const [pinned, setPinned] = useState({ serverUrl, engine: latestEngine })
    if (pinned.serverUrl !== serverUrl) {
        setPinned({ serverUrl, engine: latestEngine })
    }
    const engine = pinned.serverUrl === serverUrl ? pinned.engine : latestEngine
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
                queryFn: async ({ signal }) => {
                    const fetched = await source.load(engine, signal)
                    // The engine loads while the rules' metadata does; a program without rules never asks for it.
                    if (fetched.rules?.hasRules) {
                        preloadRuleEngine()
                    }
                    return fetched
                },
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
    const fileNames = useMemo(
        () =>
            createStore<{ names: ReadonlyMap<string, string> }>()(() => ({
                names: form?.fileNames ?? new Map(),
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
        createStore<TrackerDataEntryView>()(() => ({
            status: 'loading',
            tables: [],
            records: new Map(),
            summary: summarise({}, {}, new Map(), []),
            sync: 'idle',
            addRow: placeholder.addRow,
            complete: placeholder.complete,
            reopen: placeholder.reopen,
            downloadUnsent: placeholder.downloadUnsent,
            discardFailed: placeholder.discardFailed,
            hasMore: false,
            loadingMore: false,
            loadMore: async () => {},
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

    // Every page loaded stays when the form locks.
    const paged = usePages({
        open: opened,
        form,
        source,
        engine,
        view,
        announce: announcer.announce,
        orgUnitNames,
        fileNames,
    })
    const lockedView = useMemo(
        () =>
            locked && paged !== undefined
                ? lockedForm(paged, settings, source.key)
                : undefined,
        [locked, paged, settings, source.key]
    )
    const active = lockedView ?? opened ?? placeholder
    const error =
        loaded.error ??
        (account.isLoadingError ? reasonOf(account.error) : undefined) ??
        failed
    const progress = active === placeholder ? 'loading' : 'ready'
    const status = error === undefined ? progress : 'error'
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
        if (lockedView !== undefined && paged !== undefined) {
            view.setState({
                sync: 'idle',
                summary: summaryOf(lockedView, paged.fieldNames),
            })
        }
    }, [view, lockedView, paged])

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
    const records = useStore(active.tables, (state) => state.records)
    useEffect(() => view.setState({ tables, records }), [view, tables, records])
    const offline = useStore(view, ({ sync }) => sync === 'offline')
    const fileUrl = useMemo(
        () => fileUrlOf(baseUrl, () => active.tables.getState().records),
        [baseUrl, active]
    )
    useRuleEffects({
        open: opened,
        form,
        records,
        settings,
        announce: announcer.announce,
        idScope,
    })
    const people = form?.rowKind === 'person'
    const addRow = useMemo(() => {
        const label = people ? i18n.t('Add person') : i18n.t('Add event')
        return new Map(
            [...active.newRowTables].map(
                (tableId) =>
                    [
                        tableId,
                        { label, add: () => active.addRow(tableId) },
                    ] as const
            )
        )
    }, [active, people])
    const tracker = useMemo(
        (): TrackerContext => ({
            tables,
            records,
            fieldNames: form?.fieldNames,
            store: active.store,
            settings,
            idScope,
        }),
        [tables, records, form, active, settings, idScope]
    )
    return (
        <TrackerDataEntryViewContext.Provider value={view}>
            <TrackerReactContext.Provider value={tracker}>
                <Spreadsheet
                    cells={active.store}
                    annotations={active.effects}
                    tables={tables}
                    keyOf={trackerKeyOf}
                    rowKeysOf={recordsOf}
                    settings={settings}
                    idScope={idScope}
                    overrides={cells}
                    addRow={addRow}
                    orgUnitNames={orgUnitNames}
                    fileNames={fileNames}
                    engine={engine}
                    offline={offline}
                    fileUrl={fileUrl}
                    announcer={announcer}
                    RowLabel={TrackerRowLabel}
                    RowBadge={EventStatusBadge}
                    GridFooter={people ? ShowMorePeople : ShowMoreEvents}
                >
                    {children}
                </Spreadsheet>
            </TrackerReactContext.Provider>
        </TrackerDataEntryViewContext.Provider>
    )
}
