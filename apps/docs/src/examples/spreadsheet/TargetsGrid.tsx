import { useMemo, useState } from 'react'
import {
    Spreadsheet,
    SpreadsheetGrid,
    createCellStore,
    type AnnotationsState,
    type GridTable,
} from '@/components/spreadsheet'

const YEARS = ['2026', '2027', '2028']

const TARGETS: GridTable = {
    id: 'targets',
    title: 'Yearly targets',
    rows: [
        { id: 'OrgUnitA01', label: 'Hospital A' },
        { id: 'OrgUnitB02', label: 'Clinic B' },
        { id: 'OrgUnitC03', label: 'Clinic C' },
    ],
    columns: YEARS.map((year) => ({ id: year, label: year })),
    headerRows: [YEARS.map((year) => ({ id: year, label: year, span: 1 }))],
    closed: new Map(),
}

const FIELDS = new Map([['target', { valueType: 'INTEGER_POSITIVE' }]])

const SETTINGS = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const

const NO_ANNOTATIONS: AnnotationsState = {
    cells: {},
    rowMessages: new Map(),
    rowNotes: new Map(),
}
const annotations = {
    getState: () => NO_ANNOTATIONS,
    getInitialState: () => NO_ANNOTATIONS,
    subscribe: () => () => {},
}

const TargetsGrid = () => {
    const [log, setLog] = useState<string[]>([])
    const cells = useMemo(
        () =>
            createCellStore({
                fields: FIELDS,
                fieldIdOf: () => 'target',
                values: new Map(),
                settings: SETTINGS,
                annotations,
                enqueue: (key, value) =>
                    setLog((lines) => [
                        ...lines,
                        `${key} = ${value ?? '(cleared)'}`,
                    ]),
            }),
        []
    )

    return (
        <Spreadsheet
            cells={cells}
            annotations={annotations}
            tables={[TARGETS]}
            settings={SETTINGS}
        >
            <SpreadsheetGrid />
            <ul aria-label="Changes to save" className="mt-4 text-sm">
                {log.map((line, at) => (
                    <li key={at}>{line}</li>
                ))}
            </ul>
        </Spreadsheet>
    )
}

/**
 * An example: yearly targets for a few organisation units, in a grid with no rules.
 *
 * The organisation units and years are placeholders. Replace the rows and columns with your own, and send the
 * changes from `enqueue` to wherever your app saves them: this example only lists them under the grid.
 */
export default TargetsGrid
