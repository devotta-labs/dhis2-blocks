import type {
    CellKey,
    DataEntrySource,
    FormPage,
    GridColumn,
    GridRow,
    GridTable,
    HeaderCell,
    LoadedForm,
    OutboxRecord,
    SaveOutcome,
} from '@/components/data-entry'
import {
    cellKind,
    type CellKind,
    type Field,
} from '@/components/dhis2-value-types'

/**
 * The lab's own form: every value type and grid shape the block supports, built in memory from the controls, so any
 * combination can be tried without a DHIS2 program that has it. Searching org units and users, and uploading files,
 * still go to the DHIS2 the docs server proxies to.
 */

interface LabValueType {
    id: string
    label: string
    field: Field
    /** A value as DHIS2 stores it. */
    sample?: string
}

const options = (...names: string[]) =>
    names.map((name) => ({ code: name.toUpperCase(), name }))

// About as big as ICD-10 (14,240 options), from words that search the way diagnoses do: every combination once.
const WORDS = [
    ['Acute', 'Chronic', 'Recurrent', 'Mild', 'Severe'],
    ['upper', 'lower', 'left', 'right', 'central', 'outer'],
    ['lung', 'heart', 'liver', 'kidney', 'skin', 'bone'],
    ['infection', 'injury', 'disorder', 'failure'],
    ['primary', 'secondary', 'unspecified', 'other', 'late'],
    ['1', '2', '3', '4'],
]
const BIG_OPTION_SET = Array.from({ length: 14_400 }, (_, at) => {
    let rest = at
    const words = WORDS.map((list) => {
        const word = list[rest % list.length]
        rest = Math.floor(rest / list.length)
        return word
    })
    return {
        code: `D${String(at).padStart(5, '0')}`,
        name: `${words.slice(0, 4).join(' ')}, ${words.slice(4).join(' ')}`,
    }
})

export const VALUE_TYPES: LabValueType[] = [
    {
        id: 'text',
        label: 'Text',
        field: { valueType: 'TEXT' },
        sample: 'Outreach visit',
    },
    {
        id: 'masked',
        label: 'Text with mask',
        field: { valueType: 'TEXT', fieldMask: '\\d\\d-\\d\\d\\d' },
        sample: '12-345',
    },
    {
        id: 'letter',
        label: 'Letter',
        field: { valueType: 'LETTER' },
        sample: 'A',
    },
    {
        id: 'email',
        label: 'Email',
        field: { valueType: 'EMAIL' },
        sample: 'nurse@example.org',
    },
    {
        id: 'phone',
        label: 'Phone number',
        field: { valueType: 'PHONE_NUMBER' },
        sample: '+232 76 123456',
    },
    {
        id: 'url',
        label: 'URL',
        field: { valueType: 'URL' },
        sample: 'https://dhis2.org',
    },
    {
        id: 'integer',
        label: 'Integer',
        field: { valueType: 'INTEGER' },
        sample: '-4',
    },
    {
        id: 'positive',
        label: 'Positive integer',
        field: { valueType: 'INTEGER_POSITIVE' },
        sample: '12',
    },
    {
        id: 'negative',
        label: 'Negative integer',
        field: { valueType: 'INTEGER_NEGATIVE' },
        sample: '-3',
    },
    {
        id: 'zeroOrMore',
        label: 'Zero or positive',
        field: { valueType: 'INTEGER_ZERO_OR_POSITIVE' },
        sample: '0',
    },
    {
        id: 'number',
        label: 'Number',
        field: { valueType: 'NUMBER' },
        sample: '36.6',
    },
    {
        id: 'percentage',
        label: 'Percentage',
        field: { valueType: 'PERCENTAGE' },
        sample: '85',
    },
    {
        id: 'unitInterval',
        label: 'Unit interval',
        field: { valueType: 'UNIT_INTERVAL' },
        sample: '0.25',
    },
    {
        id: 'date',
        label: 'Date',
        field: { valueType: 'DATE' },
        sample: '2026-03-14',
    },
    {
        id: 'dateTime',
        label: 'Date and time',
        field: { valueType: 'DATETIME' },
        sample: '2026-03-14T09:30:00.000',
    },
    {
        id: 'time',
        label: 'Time',
        field: { valueType: 'TIME' },
        sample: '09:30',
    },
    {
        id: 'yesNo',
        label: 'Yes/No',
        field: { valueType: 'BOOLEAN' },
        sample: 'true',
    },
    {
        id: 'yesOnly',
        label: 'Yes only',
        field: { valueType: 'TRUE_ONLY' },
        sample: 'true',
    },
    {
        id: 'options',
        label: 'Option set',
        field: {
            valueType: 'TEXT',
            options: options('Mild', 'Moderate', 'Severe'),
        },
        sample: 'MODERATE',
    },
    {
        id: 'bigOptions',
        label: 'Option set (14,400)',
        field: { valueType: 'TEXT', options: BIG_OPTION_SET },
        sample: 'D00042',
    },
    {
        id: 'numberOptions',
        label: 'Number option set',
        field: {
            valueType: 'INTEGER',
            options: [
                { code: '1', name: 'One' },
                { code: '2', name: 'Two' },
                { code: '3', name: 'Three' },
            ],
        },
        sample: '2',
    },
    {
        id: 'longText',
        label: 'Long text',
        field: { valueType: 'LONG_TEXT' },
        sample: 'Seen at home.\nFollow up in two weeks.',
    },
    {
        id: 'multiText',
        label: 'Multi-select',
        field: {
            valueType: 'MULTI_TEXT',
            options: options('Fever', 'Cough', 'Rash', 'Headache'),
        },
        sample: 'FEVER,RASH',
    },
    {
        id: 'age',
        label: 'Age',
        field: { valueType: 'AGE' },
        sample: '1991-07-02',
    },
    {
        id: 'coordinate',
        label: 'Coordinate',
        field: { valueType: 'COORDINATE' },
        sample: '[-13.234,8.484]',
    },
    {
        id: 'orgUnit',
        label: 'Organisation unit',
        field: { valueType: 'ORGANISATION_UNIT' },
        sample: 'DiszpKrYNg8',
    },
    {
        id: 'username',
        label: 'Username',
        field: { valueType: 'USERNAME' },
        sample: 'admin',
    },
    { id: 'file', label: 'File', field: { valueType: 'FILE_RESOURCE' } },
    { id: 'image', label: 'Image', field: { valueType: 'IMAGE' } },
    {
        id: 'associate',
        label: 'Tracker associate',
        field: { valueType: 'TRACKER_ASSOCIATE' },
        sample: 'vOxUH373fy5',
    },
    {
        id: 'reference',
        label: 'Reference',
        field: { valueType: 'REFERENCE' },
        sample: 'ZcBPrXKahq2',
    },
    {
        id: 'geoJson',
        label: 'GeoJSON',
        field: { valueType: 'GEOJSON' },
        sample: '{"type":"Point","coordinates":[-13.234,8.484]}',
    },
]

export const SAVE_MODES = [
    ['instant', 'Saves at once'],
    ['slow', 'Saves after 2 seconds'],
    ['refuse', 'Refuses every save'],
    ['unreachable', 'Server unreachable'],
] as const

export interface LabConfig {
    valueTypes: string[]
    rows: number
    tables: number
    groupHeaders: boolean
    samples: boolean
    closedCells: boolean
    required: boolean
    readOnlyRow: boolean
    completedRow: boolean
    addRows: boolean
    paging: boolean
    save: (typeof SAVE_MODES)[number][0]
}

export const DEFAULT_CONFIG: LabConfig = {
    valueTypes: VALUE_TYPES.map(({ id }) => id),
    rows: 3,
    tables: 1,
    groupHeaders: true,
    samples: true,
    closedCells: false,
    required: false,
    readOnlyRow: false,
    completedRow: false,
    addRows: true,
    paging: false,
    save: 'instant',
}

const GROUPS = {
    text: 'Typed in the cell',
    number: 'Typed in the cell',
    date: 'Typed in the cell',
    dateTime: 'Typed in the cell',
    time: 'Typed in the cell',
    boolean: 'Control in the cell',
    trueOnly: 'Control in the cell',
    option: 'Control in the cell',
    popup: 'Pop-up editor',
    readOnly: 'Read-only',
} satisfies Record<CellKind, string>

const STAGE = 'lab'
const ORG_UNIT = 'DiszpKrYNg8'
const PAGES = 3

/** Over its columns, the header row of their groups: one header per run of columns that edit the same way. */
const groupRow = (columns: GridColumn[]): HeaderCell[] => {
    const cells: HeaderCell[] = []
    for (const { field } of columns) {
        const label = GROUPS[cellKind(field)]
        const last = cells.at(-1)
        if (last?.label === label) {
            last.span += 1
        } else {
            cells.push({ id: `group-${cells.length}`, label, span: 1 })
        }
    }
    return cells
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A new source for each config: its own key, so the grid loads again, and its own values. */
export const labSource = (
    config: LabConfig,
    onSave: (records: ReadonlyArray<OutboxRecord>) => void
): DataEntrySource => {
    const chosen = VALUE_TYPES.filter(({ id }) =>
        config.valueTypes.includes(id)
    )
    const columns: GridColumn[] = chosen.map(({ id, label, field }) => ({
        id,
        label,
        field,
    }))
    const headerRows = [
        ...(config.groupHeaders ? [groupRow(columns)] : []),
        columns.map(({ id, label }) => ({ id, label, span: 1 })),
    ]
    const tableIds = Array.from(
        { length: config.tables },
        (_, at) => `table${at + 1}`
    )

    const rowsOf = (tableId: string, page: number): GridRow[] =>
        Array.from({ length: config.rows }, (_, at) => {
            const n = page * config.rows + at + 1
            return {
                id: `${tableId}-row${n}`,
                label: `Row ${n}`,
                programStageId: STAGE,
                orgUnitId: ORG_UNIT,
                status:
                    config.completedRow && page === 0 && at === 0
                        ? 'COMPLETED'
                        : 'ACTIVE',
            }
        })

    // Every fifth cell, in a diagonal, has no control.
    const isClosed = (rowAt: number, columnAt: number) =>
        config.closedCells && (rowAt + columnAt) % 5 === 4

    const stored = new Map<CellKey, string>()

    const pageOf = (page: number): FormPage => {
        const tables: GridTable[] = tableIds.map((tableId) => {
            const rows = rowsOf(tableId, page)
            const closed = new Map<CellKey, string>()
            rows.forEach((row, rowAt) => {
                columns.forEach((column, columnAt) => {
                    const key: CellKey = `${row.id}.${column.id}`
                    if (isClosed(rowAt, columnAt)) {
                        closed.set(key, 'Not used')
                    } else if (
                        config.samples &&
                        (rowAt + columnAt) % 2 === 0 &&
                        !stored.has(key)
                    ) {
                        const sample = chosen[columnAt].sample
                        if (sample !== undefined) {
                            stored.set(key, sample)
                        }
                    }
                })
            })
            return {
                id: tableId,
                title: `Table ${tableId.slice(5)}`,
                rows,
                columns,
                headerRows,
                closed,
            }
        })
        const firstRows = tables.flatMap((table) => table.rows.slice(0, 2))
        return {
            tables,
            values: new Map(stored),
            readOnlyRows: new Map(
                config.readOnlyRow && firstRows[1] !== undefined
                    ? [[firstRows[1].id, 'This row is read-only in the lab']]
                    : []
            ),
            canReopen: new Set(firstRows.map(({ id }) => id)),
            orgUnitNames: new Map([[ORG_UNIT, 'Ngelehun CHC']]),
            fileNames: new Map(),
            hasMore: config.paging && page < PAGES - 1,
        }
    }

    // Each save answers as the chosen mode says, after logging what the grid sent.
    const answer = async (
        records: ReadonlyArray<{ sourceKey: string; key: CellKey }>,
        store: () => void
    ) => {
        if (config.save === 'slow') {
            await wait(2000)
        }
        if (config.save === 'unreachable') {
            throw new Error('The lab server is unreachable')
        }
        if (config.save === 'refuse') {
            return records.map(({ sourceKey, key }): SaveOutcome => ({
                sourceKey,
                key,
                result: 'failed',
                reason: 'The lab refuses every save',
            }))
        }
        store()
        return records.map(({ sourceKey, key }): SaveOutcome => ({
            sourceKey,
            key,
            result: 'saved',
        }))
    }

    const key = `lab:${JSON.stringify(config)}`
    return {
        key,
        load: async (): Promise<LoadedForm> => ({
            ...pageOf(0),
            required: new Map(
                config.required
                    ? [
                          [
                              STAGE,
                              new Set(
                                  columns
                                      .filter((_, at) => at % 3 === 0)
                                      .map(({ id }) => id)
                              ),
                          ],
                      ]
                    : []
            ),
            strategy: new Map([[STAGE, 'ON_UPDATE_AND_INSERT']]),
            sections: new Map(),
            readOnlyWhenCompleted: new Map(),
            mayUncomplete: true,
            closedByStage: new Map(),
            newRows: config.addRows
                ? {
                      tableId: tableIds[0],
                      programStageId: STAGE,
                      orgUnitId: ORG_UNIT,
                  }
                : undefined,
        }),
        loadPage: async (_engine, page) => {
            await wait(500)
            return pageOf(page - 1)
        },
        save: async (_engine, records) => {
            onSave(records)
            return answer(records, () => {
                for (const { key: cell, value } of records) {
                    if (value === null) {
                        stored.delete(cell)
                    } else {
                        stored.set(cell, value)
                    }
                }
            })
        },
        // The grid keeps the row's status itself once saved; the lab has nothing more to store.
        setStatus: async (_engine, rowId) =>
            answer(
                [{ sourceKey: key, key: `${rowId}.status` }],
                () => undefined
            ),
        // shortcut: unsent new rows are not shown again after a reload; the lab starts afresh on each load anyway.
        restoreRows: async () => [],
    }
}
