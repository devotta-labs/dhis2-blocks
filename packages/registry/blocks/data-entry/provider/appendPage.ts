import i18n from '@dhis2/d2-i18n'
import { useEffect, useState } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { formatCount } from '../cells/OptionCell'
import { cellKey, rowIdOf } from '../model/types'
import type { CellKey, GridColumn, GridRow, GridTable } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import type {
    DataEngine,
    DataEntrySource,
    FormPage,
    LoadedForm,
} from '../sources/types'
import type { DataEntryState } from '../store/store'
import type { EffectsState } from './context'
import { formEffects, withColumns, withRows } from './formRows'
import { reasonOf } from './hooks'
import type { DataEntryView } from './hooks'
import type { OpenForm } from './openForm'

/**
 * The table with the rows of `more` that `fresh` takes and the columns it lacks, at its end; their closed cells by
 * stage, and those `more` closed in its own fresh rows. A row already shown keeps what is known of it.
 */
const grow = (
    form: LoadedForm,
    table: GridTable,
    more: GridTable | undefined,
    fresh: (rowId: string) => boolean
) => {
    if (more === undefined) {
        return { table, rows: [], columns: [] }
    }
    const shown = new Set(table.columns.map(({ id }) => id))
    const columns = more.columns.filter(({ id }) => !shown.has(id))
    const rows = more.rows.filter(({ id }) => fresh(id))
    const next = withRows(form, withColumns(form, table, columns), rows)
    const closed = [...more.closed].filter(([key]) => fresh(rowIdOf(key)))
    return {
        table: { ...next, closed: new Map([...next.closed, ...closed]) },
        rows,
        columns,
    }
}

/** The form as DHIS2 had it, with a page: its rows the form does not hold yet, their values, and what is known of them. */
export const withPage = (form: LoadedForm, page: FormPage): LoadedForm => {
    const held = new Set(
        form.tables.flatMap(({ rows }) => rows.map(({ id }) => id))
    )
    const fresh = (rowId: string) => !held.has(rowId)
    return {
        ...form,
        tables: form.tables.map(
            (table) =>
                grow(
                    form,
                    table,
                    page.tables.find(({ id }) => id === table.id),
                    fresh
                ).table
        ),
        values: new Map([
            ...form.values,
            ...[...page.values].filter(([key]) => fresh(rowIdOf(key))),
        ]),
        readOnlyRows: new Map([
            ...form.readOnlyRows,
            ...[...page.readOnlyRows].filter(([id]) => fresh(id)),
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
    store: StoreApi<DataEntryState>
    effects: StoreApi<EffectsState>
    tables: StoreApi<{ tables: ReadonlyArray<GridTable> }>
    /** Every row of the form, by id. */
    rows: Map<string, GridRow>
    readOnlyRows: Map<string, string>
    reopenable: Set<string>
}

/**
 * Appends a page to the open form: to each of its tables, the rows it does not show yet and the columns it lacks, at
 * its end, then the unsent changes `list` reads for the cells that now exist. It writes nothing. Resolves to what the
 * outbox holds once the page is in.
 */
export const appendPage = async (
    { form, store, effects, tables, rows, readOnlyRows, reopenable }: Growing,
    page: FormPage,
    list: () => Promise<ReadonlyArray<OutboxRecord>>
) => {
    const held = await list()
    const fresh = new Set<string>()
    const columns: GridColumn[] = []
    const cells = new Set<CellKey>()
    const grown = tables.getState().tables.map((table) => {
        const next = grow(
            form,
            table,
            page.tables.find(({ id }) => id === table.id),
            (rowId) => !rows.has(rowId)
        )
        columns.push(...next.columns)
        for (const row of next.rows) {
            fresh.add(row.id)
            rows.set(row.id, row)
            const reason = page.readOnlyRows.get(row.id)
            if (reason !== undefined) {
                readOnlyRows.set(row.id, reason)
            }
            if (page.canReopen.has(row.id)) {
                reopenable.add(row.id)
            }
        }
        for (const row of next.table.rows) {
            const columnsOf = fresh.has(row.id)
                ? next.table.columns
                : next.columns
            for (const { id } of columnsOf) {
                cells.add(cellKey(row.id, id))
            }
        }
        return next.table
    })

    // The values go in before the rows that show them, so the rules first see a row with its values.
    const restored = held.filter(({ key }) => cells.has(key))
    store.getState().addColumns(columns)
    store.getState().restore([
        ...Array.from(page.values)
            .filter(([key]) => fresh.has(rowIdOf(key)))
            .map(([key, value]) => ({
                key,
                value,
                base: value,
                sync: 'idle' as const,
            })),
        ...restored.map((record) => ({ ...record, sync: record.state })),
    ])
    effects.setState(({ cells: now }) => ({
        cells: formEffects(
            form.required,
            readOnlyRows,
            grown.map((table) => ({
                ...table,
                rows: table.rows.filter(({ id }) => fresh.has(id)),
            })),
            { ...now }
        ),
    }))
    tables.setState({ tables: grown })

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

const NOTHING_MORE = async () => {}

interface PagesOptions {
    open?: OpenForm
    form?: LoadedForm
    source: DataEntrySource
    engine: DataEngine
    view: StoreApi<DataEntryView>
    announce(text: string): void
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
    open,
    form,
    source,
    engine,
    view,
    announce,
    orgUnitNames,
    fileNames,
}: PagesOptions) => {
    const [paged, setPaged] = useState<{ from: LoadedForm; to: LoadedForm }>()
    useEffect(() => {
        if (
            open === undefined ||
            form === undefined ||
            source.loadPage === undefined
        ) {
            return undefined
        }
        const stop = new AbortController()
        let pages = 1
        let loading = false
        view.setState({
            hasMore: form.hasMore,
            loadingMore: false,
            async loadMore() {
                if (loading || !view.getState().hasMore) {
                    return
                }
                loading = true
                view.setState({ loadingMore: true, loadMoreError: undefined })
                await source
                    .loadPage?.(engine, pages + 1, stop.signal)
                    .then(async (page) => {
                        await open.append(page)
                        if (stop.signal.aborted) {
                            return
                        }
                        pages += 1
                        setPaged((last) => ({
                            from: form,
                            to: withPage(
                                last?.from === form ? last.to : form,
                                page
                            ),
                        }))
                        merge(orgUnitNames, page.orgUnitNames)
                        merge(fileNames, page.fileNames)
                        view.setState({ hasMore: page.hasMore })
                        const shown = open.tables
                            .getState()
                            .tables.reduce(
                                (sum, { rows }) => sum + rows.length,
                                0
                            )
                        announce(
                            i18n.t('Events shown: {{shown}}', {
                                nsSeparator: '::',
                                shown: formatCount(shown),
                            })
                        )
                    })
                    // Said as the form says why it could not load, and shown beside the button.
                    .catch((error: Error) => {
                        if (!stop.signal.aborted) {
                            const reason = reasonOf(error)
                            view.setState({ loadMoreError: reason })
                            announce(reason)
                        }
                    })
                loading = false
                if (!stop.signal.aborted) {
                    view.setState({ loadingMore: false })
                }
            },
        })
        return () => {
            stop.abort()
            view.setState({
                hasMore: false,
                loadingMore: false,
                loadMoreError: undefined,
                loadMore: NOTHING_MORE,
            })
        }
        // A source with the same keys is the same form: its keys are in the form's query key.
    }, [open, form, engine, view, announce, orgUnitNames, fileNames])
    return paged !== undefined && paged.from === form ? paged.to : form
}
