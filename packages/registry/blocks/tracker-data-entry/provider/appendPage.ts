import i18n from '@dhis2/d2-i18n'
import { useEffect, useState } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { formatCount } from '@/components/spreadsheet'
import type {
    CellKey,
    GridTable,
    DataEngine,
    CellStoreState,
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
        ...restored.map((record) => ({ ...record, sync: record.state })),
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

const NOTHING_MORE = async () => {}

interface PagesOptions {
    open?: OpenForm
    form?: LoadedForm
    source: TrackerDataEntrySource
    engine: DataEngine
    view: StoreApi<TrackerDataEntryView>
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
                            form.rowKind === 'person'
                                ? i18n.t('People shown: {{shown}}', {
                                      nsSeparator: '::',
                                      shown: formatCount(shown),
                                  })
                                : i18n.t('Events shown: {{shown}}', {
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
