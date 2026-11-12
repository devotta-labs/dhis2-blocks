import i18n from '@dhis2/d2-i18n'
import { skipToken, useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { formatCount } from '@/components/spreadsheet'
import type {
    Announcer,
    CellKey,
    CellStoreState,
    DataEngine,
    GridTable,
} from '@/components/spreadsheet'
import { trackerKeyOf, recordsOf, recordIdOf } from '../model/types'
import type { DataRecord, TrackerColumn, TrackerRow } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import type {
    TrackerDataEntrySource,
    FormPage,
    LoadedForm,
} from '../sources/types'
import type { TrackerEffectsState } from '../logic/effects'
import { formEffects, isRecordField, withColumns, withRows } from './formRows'
import { reasonOf } from './hooks'
import type { TrackerDataEntryView } from './hooks'
import type { FormTables, OpenForm } from './openForm'

/**
 * The table with the rows of `more` that `fresh` takes and the columns it lacks, at its end; their closed cells by
 * their records' stages, and those `more` closed in its own fresh rows. A row already shown keeps what is known of it.
 */
const grow = (
    form: LoadedForm,
    table: GridTable<TrackerRow, TrackerColumn>,
    more: GridTable<TrackerRow, TrackerColumn> | undefined,
    fresh: (rowId: string) => boolean,
    records: ReadonlyMap<string, DataRecord>
) => {
    if (more === undefined) {
        return { table, rows: [], columns: [] }
    }
    const shown = new Set(table.columns.map(({ id }) => id))
    const columns = more.columns.filter(({ id }) => !shown.has(id))
    const rows = more.rows.filter(({ id }) => fresh(id))
    const next = withRows(
        form,
        withColumns(form, table, columns, records),
        rows,
        records
    )
    const added = new Set(rows.flatMap(recordsOf))
    const closed = [...more.closed].filter(([key]) =>
        added.has(recordIdOf(key))
    )
    return {
        table: { ...next, closed: new Map([...next.closed, ...closed]) },
        rows,
        columns,
    }
}

/** The records of `known`, then those of `page` it does not hold: a record already held keeps what is known of it. */
const withRecords = (
    known: ReadonlyMap<string, DataRecord>,
    page: ReadonlyMap<string, DataRecord>
) => new Map([...known, ...[...page].filter(([id]) => !known.has(id))])

/**
 * The form as DHIS2 had it, with a page: its rows and records the form does not hold yet, their values, and what is
 * known of them.
 */
export const withPage = (form: LoadedForm, page: FormPage): LoadedForm => {
    const fresh = (recordId: string) => !form.records.has(recordId)
    const records = withRecords(form.records, page.records)
    return {
        ...form,
        tables: form.tables.map(
            (table) =>
                grow(
                    form,
                    table,
                    page.tables.find(({ id }) => id === table.id),
                    fresh,
                    records
                ).table
        ),
        values: new Map([
            ...form.values,
            ...[...page.values].filter(([key]) => fresh(recordIdOf(key))),
        ]),
        records,
        readOnlyRecords: new Map([
            ...form.readOnlyRecords,
            ...[...page.readOnlyRecords].filter(([id]) => fresh(id)),
        ]),
        canReopen: new Set([
            ...form.canReopen,
            ...[...page.canReopen].filter(fresh),
        ]),
        hasMore: page.hasMore,
    }
}

/** What of the open form a page grows, or a saved status changes. */
export interface Growing {
    form: LoadedForm
    store: StoreApi<CellStoreState>
    effects: StoreApi<TrackerEffectsState>
    tables: StoreApi<FormTables>
    readOnlyRecords: Map<string, string>
    reopenable: Set<string>
}

/**
 * Appends a page to the open form: to each of its tables, the rows it does not show yet and the columns it lacks, at
 * its end, with the records it does not hold yet; then the unsent changes `list` reads for the cells that now exist
 * and for the new records' fields no column shows. It writes nothing. Resolves to what the outbox holds once the page
 * is in.
 */
export const appendPage = async (
    { form, store, effects, tables, readOnlyRecords, reopenable }: Growing,
    page: FormPage,
    list: () => Promise<ReadonlyArray<OutboxRecord>>
) => {
    const held = await list()
    const known = tables.getState().records
    const records = withRecords(known, page.records)
    for (const id of page.records.keys()) {
        if (known.has(id)) {
            continue
        }
        const reason = page.readOnlyRecords.get(id)
        if (reason !== undefined) {
            readOnlyRecords.set(id, reason)
        }
        if (page.canReopen.has(id)) {
            reopenable.add(id)
        }
    }
    // The records the form gets from the page: one it holds already had its changes put back.
    const fresh = new Set<string>()
    const cells = new Set<CellKey>()
    const grown = tables.getState().tables.map((table) => {
        const next = grow(
            form,
            table,
            page.tables.find(({ id }) => id === table.id),
            (recordId) => !known.has(recordId),
            records
        )
        for (const row of next.rows) {
            recordsOf(row)
                .filter((id) => !known.has(id))
                .forEach((id) => fresh.add(id))
        }
        for (const row of next.table.rows) {
            const added = fresh.has(row.id)
            for (const column of added ? next.table.columns : next.columns) {
                const key = trackerKeyOf(row, column)
                if (!added || fresh.has(recordIdOf(key))) {
                    cells.add(key)
                }
            }
        }
        return next.table
    })

    // The values go in before the rows that show them, so the rules first see a row with its values.
    // A new record's fields no column shows are the form's too: rules may have assigned them.
    const restored = held.filter(
        ({ key }) =>
            cells.has(key) ||
            (fresh.has(recordIdOf(key)) && isRecordField(form, records, key))
    )
    store.getState().restore([
        ...Array.from(page.values)
            .filter(([key]) => fresh.has(recordIdOf(key)))
            .map(([key, value]) => ({
                key,
                value,
                base: value,
                sync: 'idle' as const,
            })),
        // DHIS2 holds what the page just loaded, whatever it held when the change was made.
        ...restored.map((record) => ({
            ...record,
            base: page.values.get(record.key) ?? null,
            sync: record.state,
        })),
    ])
    effects.setState(({ cells: now, rowNotes }) => ({
        cells: formEffects(
            form,
            readOnlyRecords,
            [{ rows: [...fresh].map((id) => ({ id })) }],
            records,
            { ...now }
        ),
        // The source's notes on the new rows, as the load's are.
        rowNotes: new Map([
            ...rowNotes,
            ...[...(page.rowNotes ?? [])].filter(([id]) => fresh.has(id)),
        ]),
    }))
    tables.setState({ tables: grown, records })

    const unsent = restored.filter(({ state }) => state !== 'failed')
    if (unsent.length === 0) {
        return held
    }
    // Read again: an outcome that came before its cell existed found no cell to say it on. Only a help: a read that
    // fails leaves the cells as restored.
    const now = await list().catch(() => undefined)
    if (now === undefined) {
        return held
    }
    for (const record of unsent) {
        const left = now.find(({ key }) => key === record.key)
        // Only a saved change leaves the outbox unless it failed first; a newer change in its cell is its own.
        if (left === undefined) {
            store.getState().markSync([record], 'saved')
        } else if (left.at === record.at && left.state !== record.state) {
            store.getState().markSync([left], left.state, left.reason)
        }
    }
    return now
}

type Names = StoreApi<{ names: ReadonlyMap<string, string> }>

const merge = (names: Names, more: ReadonlyMap<string, string>) =>
    names.setState(({ names: known }) => ({
        names: new Map([...known, ...more]),
    }))

/** How many rows the open form shows, for the live region. */
const shownText = (form: LoadedForm, open: OpenForm) => {
    const shown = formatCount(
        open.tables
            .getState()
            .tables.reduce((sum, { rows }) => sum + rows.length, 0)
    )
    return form.rowKind === 'person'
        ? i18n.t('People shown: {{shown}}', { nsSeparator: '::', shown })
        : i18n.t('Events shown: {{shown}}', { nsSeparator: '::', shown })
}

interface PagesOptions {
    /** One per loaded form: the pages loaded after it are cached under it. */
    queryKey: ReadonlyArray<string>
    open?: OpenForm
    form?: LoadedForm
    source: TrackerDataEntrySource
    engine: DataEngine
    view: StoreApi<TrackerDataEntryView>
    announce: Announcer['announce']
    orgUnitNames: Names
    fileNames: Names
}

/**
 * The view's `loadMore` for the open form of a source with pages: each call appends the page after the last one, one
 * at a time, and says how many events show; a page that fails to load says why, keeps why in `loadMoreError` until
 * the next try, and is asked for again next time.
 * Returns the form as DHIS2 had it with every page loaded, for the form to show when it locks.
 */
export const usePages = ({
    queryKey,
    open,
    form,
    source,
    engine,
    view,
    announce,
    orgUnitNames,
    fileNames,
}: PagesOptions) => {
    const { loadPage } = source
    const paging =
        open !== undefined && form !== undefined && loadPage !== undefined
    const query = useInfiniteQuery({
        queryKey,
        // A page is loaded once its rows are in the open form: the button stays busy until then.
        queryFn: paging
            ? async ({ pageParam, signal }) => {
                  const page = await loadPage(engine, pageParam, signal)
                  await open.append(page)
                  // Stopped (the form closed, or was opened again), the page is no one's to announce.
                  if (!signal.aborted) {
                      merge(orgUnitNames, page.orgUnitNames)
                      merge(fileNames, page.fileNames)
                      announce(shownText(form, open))
                  }
                  return page
              }
            : skipToken,
        // The form is the first page.
        initialPageParam: 2,
        getNextPageParam: (page, _pages, number) =>
            page.hasMore ? number + 1 : undefined,
        // Only `loadMore` asks.
        enabled: false,
        gcTime: 0,
        retry: false,
        // Offline, a page says why it cannot load rather than wait for the connection.
        networkMode: 'always',
    })
    const pages = query.data?.pages
    const hasMore =
        paging && (pages === undefined ? form.hasMore : query.hasNextPage)
    const loadingMore = paging && query.isFetching
    // The query keeps why a page failed while it is asked for again; the view drops it at once.
    const loadMoreError =
        paging && query.isError && !loadingMore
            ? reasonOf(query.error)
            : undefined
    const { fetchNextPage } = query
    useEffect(() => {
        view.setState({
            hasMore,
            loadingMore,
            loadMoreError,
            async loadMore() {
                if (hasMore) {
                    // One page at a time: a call while a page loads waits for that page.
                    await fetchNextPage({ cancelRefetch: false })
                }
            },
        })
    }, [view, hasMore, loadingMore, loadMoreError, fetchNextPage])
    // Said as the form says why it could not load, and shown beside the button. Each failure is said: one right after
    // another, for the same reason, changes only the count.
    const failures = query.errorUpdateCount
    useEffect(() => {
        if (loadMoreError !== undefined) {
            announce(loadMoreError, 'assertive')
        }
    }, [announce, loadMoreError, failures])
    return useMemo(
        () =>
            form === undefined || pages === undefined
                ? form
                : pages.reduce(withPage, form),
        [form, pages]
    )
}
