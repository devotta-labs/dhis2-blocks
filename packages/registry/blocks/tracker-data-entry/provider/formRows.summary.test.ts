import { createStore } from 'zustand/vanilla'
import { cellKey, createCellStore } from '@/components/spreadsheet'
import type { CellKey } from '@/components/spreadsheet'
import { effectsWriter, FORM_MESSAGES } from '../logic/effects'
import type {
    TrackerEffects,
    TrackerEffectsState,
    TrackerMessage,
} from '../logic/effects'
import { formOf } from '../model/types'
import type { TrackerRow } from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import {
    ENROLLED_AT,
    FIRST_NAME,
    GESTATIONAL_AGE,
    NGELEHUN,
    newRow,
    recordsOf,
    registerForm,
    UNIQUE_ID,
} from '../sources/__tests__/trackerRig'
import type { Row } from '../sources/__tests__/trackerRig'
import type { LoadedForm } from '../sources/types'
import { addRow } from './addRow'
import { followSummary, formEffects, summaryOf } from './formRows'
import type { FormTables } from './openForm'

const SETTINGS = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const
const SYNCS = ['sending', 'saved', 'failed', 'waiting', 'queued'] as const
const TEXTS = ['', '1', '12', 'x', 'Amina', '2026-01-05']
const REASONS = [undefined, 'No connection', 'Value is not a number']

/** Whole numbers from 0 up to a limit, the same every run of a seed. */
const numbers = (seed: number) => {
    let state = seed
    return (below: number) => {
        state = (state * 48271) % 2147483647
        return state % below
    }
}

/** A person's row of the register, with the records its slots save to. */
const person = (n: number) => {
    const records: Row = newRow({
        person: `p${n}`,
        enrollment: `en${n}`,
        anc1: `a${n}`,
        anc2: `b${n}`,
        birth: `c${n}`,
    })
    const row: TrackerRow = {
        id: records.enrollment.id,
        label: `Person ${n}`,
        slots: {
            person: records.person.id,
            enrollment: records.enrollment.id,
            anc1: records.anc1.id,
            'anc2#1': records.anc2.id,
            birth: records.birth.id,
        },
    }
    return { row, records: recordsOf(records) }
}

/** A register of two people with its open stores, as `openForm` makes them, and its summary followed. */
const opened = () => {
    const people = [person(0), person(1)]
    const records = people.flatMap((each) => each.records)
    const [first] = records
    const visits = records.filter(({ kind }) => kind === 'event').map(formOf)
    const base = registerForm(records)
    const form: LoadedForm = {
        ...base,
        tables: [
            { ...base.tables[0], rows: people.map(({ row }) => row) },
            // A second table: its rows' names are read for a required field too.
            { ...base.tables[0], id: 'other', columns: [] },
        ],
        fields: new Map([
            [UNIQUE_ID, { valueType: 'TEXT' }],
            [FIRST_NAME, { valueType: 'TEXT' }],
            [ENROLLED_AT, { valueType: 'DATE' }],
            [EVENT_DATE_COLUMN, { valueType: 'DATE' }],
            [GESTATIONAL_AGE, { valueType: 'INTEGER' }],
        ]),
        fieldsByForm: new Map([
            [formOf(first), new Set([UNIQUE_ID, FIRST_NAME])],
            ...visits.map((stage): [string, Set<string>] => [
                stage,
                new Set([GESTATIONAL_AGE]),
            ]),
        ]),
        required: new Map([
            [formOf(first), new Set([FIRST_NAME])],
            ...visits.map((stage): [string, Set<string>] => [
                stage,
                new Set([GESTATIONAL_AGE]),
            ]),
        ]),
        // A field with no column is named by the form.
        fieldNames: new Map([[UNIQUE_ID, 'Unique identifier']]),
        newRows: { tableId: 'register', orgUnitId: NGELEHUN },
    }
    const readOnlyRecords = new Map<string, string>()
    const tables = createStore<FormTables>()(() => ({
        tables: form.tables,
        records: form.records,
    }))
    const effects = createStore<TrackerEffectsState>()(() => ({
        cells: formEffects(form, readOnlyRecords, form.tables, form.records),
        rowMessages: new Map(),
        rowNotes: new Map(),
    }))
    const store = createCellStore({
        fields: form.fields,
        values: new Map([[cellKey(first.id, FIRST_NAME), 'Amina']]),
        settings: SETTINGS,
        enqueue: () => {},
        annotations: effects,
    })
    return { form, store, effects, tables, readOnlyRecords }
}

/**
 * Something else that writes to the stores from their own updates, as the slot order's warnings do: a draft of one
 * letter is dropped at once, a cell with a draft has a warning, the form has one while any row has a message, and new
 * notes take a person's effect away and put it back, before one that comes and goes.
 */
const warned = ({ form, store, effects }: ReturnType<typeof opened>) => {
    const typing: TrackerMessage = {
        tone: 'warning',
        text: 'Being typed',
        source: 'valueType',
    }
    const nothing: TrackerEffects = { required: false, messages: [] }
    const [{ id }] = form.records.values()
    const stops = [
        store.subscribe(({ cells, changedCellKeys }) => {
            const letter = changedCellKeys.find(
                (key) => cells[key]?.draft === 'x'
            )
            if (letter !== undefined) {
                store.getState().discardDraft(letter)
            }
        }),
        store.subscribe(({ cells, changedCellKeys }) => {
            const writer = effectsWriter(effects.getState())
            for (const key of changedCellKeys) {
                const now = effects.getState().cells[key] ?? nothing
                const others = now.messages.filter(
                    ({ source }) => source !== 'valueType'
                )
                writer.setCell(key, {
                    ...now,
                    messages:
                        cells[key]?.draft === undefined
                            ? others
                            : [...others, typing],
                })
            }
            const wrote = writer.state()
            if (wrote.cells !== effects.getState().cells) {
                effects.setState(wrote)
            }
        }),
        effects.subscribe((state, before) => {
            const writer = effectsWriter(state)
            if (state.rowNotes !== before.rowNotes) {
                const [comes, back] = [UNIQUE_ID, FIRST_NAME].map((field) =>
                    cellKey(id, field)
                )
                const asked = { required: true, messages: [typing] }
                writer.setCell(back, nothing)
                writer.setCell(back, asked)
                writer.setCell(comes, state.cells[comes] ? nothing : asked)
            }
            const rows = [...state.rowMessages.keys()].filter(
                (row) => row !== FORM_MESSAGES
            )
            writer.setRowMessages(
                FORM_MESSAGES,
                rows.length > 0 ? [typing] : []
            )
            const wrote = writer.state()
            if (
                wrote.cells !== state.cells ||
                wrote.rowMessages !== state.rowMessages
            ) {
                effects.setState(wrote)
            }
        }),
    ]
    return () => stops.forEach((stop) => stop())
}

test('the followed summary is the whole summary after any edits, effects, rows and records', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const below = numbers(seed)
        const pick = <T>(list: ReadonlyArray<T>) => list[below(list.length)]
        const open = opened()
        const { form, store, effects, tables, readOnlyRecords } = open
        // The other writer subscribes first for some seeds: the summary then hears of its updates out of order.
        const stopFirst = seed % 4 === 0 ? warned(open) : undefined
        const summary = followSummary(open, () => {})
        const stopLast = stopFirst === undefined ? warned(open) : undefined

        const records = () => [...tables.getState().records.values()]
        const keys = () =>
            records().flatMap((record) =>
                [
                    ...(record.kind === 'event' ? [EVENT_DATE_COLUMN] : []),
                    ...(form.fieldsByForm.get(formOf(record)) ?? []),
                ].map((field) => cellKey(record.id, field))
            )
        const message = (): TrackerMessage => ({
            tone: pick(['error', 'warning'] as const),
            text: pick(['Too high', 'Check this', 'Unusual']),
            source: 'rule',
            onComplete: pick([true, undefined, undefined]),
        })
        const messages = () => Array.from({ length: below(3) }, () => message())
        const said = (): TrackerEffects => ({
            required: below(2) === 0,
            messages: messages(),
            readOnly: pick([undefined, undefined, 'Locked']),
        })
        /** Writes to the effects that keep track of what they wrote, some to a cell written before in the same update. */
        const told = () => {
            const writer = effectsWriter(effects.getState())
            const written = Array.from({ length: 1 + below(4) }, () =>
                pick(keys())
            )
            for (const key of [...written, written[0]]) {
                if (below(4) === 0) {
                    writer.setRowMessages(
                        pick(records()).id,
                        below(3) === 0 ? [] : messages()
                    )
                } else {
                    writer.setCell(key, said())
                }
            }
            return writer.state()
        }
        const cell = (key: CellKey) => store.getState().cells[key]

        const steps: Array<() => void> = [
            () => store.getState().commit(pick(keys()), pick(TEXTS)),
            () =>
                store.getState().commitMany(
                    Array.from({ length: 1 + below(5) }, () => ({
                        key: pick(keys()),
                        text: pick(TEXTS),
                    })),
                    pick(['person', 'rule'] as const)
                ),
            () => {
                const sent = Array.from({ length: 1 + below(3) }, () =>
                    pick(keys())
                )
                store.getState().markSync(
                    sent.map((key) => ({
                        key,
                        value: cell(key)?.value ?? null,
                    })),
                    pick(SYNCS),
                    pick(REASONS)
                )
            },
            () =>
                store.getState().restore([
                    {
                        key: pick(keys()),
                        value: pick([null, '3', 'Musa']),
                        base: null,
                        sync: pick(SYNCS),
                        reason: pick(REASONS),
                    },
                ]),
            () => store.getState().keepDraft(pick(keys()), 'x', 'Not a number'),
            () => store.getState().discardDraft(pick(keys())),
            () => store.getState().undo(),
            () => effects.setState(told()),
            () => effects.setState(told()),
            // An update that keeps no track: a record's effects made again, after the others, as a saved status does.
            () => {
                const { id } = pick(records())
                if (below(2) === 0) {
                    readOnlyRecords.set(id, 'Completed')
                } else {
                    readOnlyRecords.delete(id)
                }
                effects.setState(({ cells }) => ({
                    cells: formEffects(
                        form,
                        readOnlyRecords,
                        [{ rows: [{ id }] }],
                        tables.getState().records,
                        Object.fromEntries(
                            Object.entries(cells).filter(
                                ([key]) => !key.startsWith(`${id}.`)
                            )
                        )
                    ),
                }))
            },
            // And a row's messages replaced, as a new row's are added.
            () =>
                effects.setState(({ rowMessages }) => ({
                    rowMessages: new Map([
                        ...rowMessages,
                        [pick(records()).id, [message()]],
                    ]),
                })),
            // An update that keeps track and wrote nothing, and one of the notes alone.
            () => effects.setState(effectsWriter(effects.getState()).state()),
            () =>
                effects.setState(({ rowNotes }) => ({
                    rowNotes: new Map(rowNotes).set(pick(records()).id, [
                        `Note ${below(9)}`,
                    ]),
                })),
            // An update made from effects that another has written over since.
            () => {
                const stale = told()
                effects.setState(told())
                effects.setState(stale)
            },
            () => {
                const next = person(records().length)
                addRow(
                    { ...open, reopenable: new Set() },
                    {
                        newRow: () => ({
                            ...next,
                            values: new Map([
                                [cellKey(next.records[0].id, UNIQUE_ID), '7'],
                            ]),
                            messages: new Map([
                                [next.records[0].id, [message()]],
                            ]),
                        }),
                    },
                    SETTINGS,
                    'register'
                )
            },
            // A slot's event that is no longer new is asked for its required fields.
            () => {
                const record = pick(records())
                tables.setState(({ records: all }) => ({
                    records: new Map(all).set(record.id, {
                        ...record,
                        isNew: below(2) === 0,
                    }),
                }))
            },
        ]

        for (let step = 0; step < 400; step += 1) {
            const at = below(steps.length)
            steps[at]()
            // Not after every update: what several wrote is summed up at once.
            if (below(3) > 0) {
                expect(
                    summary.read(form),
                    `seed ${seed}, step ${step} (${at})`
                ).toEqual(summaryOf(open, form))
            }
        }
        const last = summary.read(form)
        expect(last).toEqual(summaryOf(open, form))
        expect(summary.read(form)).toBe(last)
        // Changes no cell of the form holds are counted in.
        expect(summary.read(form, { unsent: 2, failed: 1 })).toEqual({
            ...last,
            unsent: last.unsent + 2,
            failed: last.failed + 1,
        })
        summary.stop()
        stopFirst?.()
        stopLast?.()
    }
})
