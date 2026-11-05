import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo, useState } from 'react'
import {
    Spreadsheet,
    SpreadsheetGrid,
    createCellStore,
    type AnnotationsState,
    type GridTable,
} from '@/components/spreadsheet'

/**
 * An example: yearly targets for a few organisation units, in a grid with no rules.
 *
 * The organisation units and years are placeholders. Replace the rows and columns with your own, and send the
 * changes from `enqueue` to wherever your app saves them: this example only lists them under the grid.
 */

const YEARS = ['2026', '2027', '2028']

const TARGETS: GridTable = {
    id: 'targets',
    title: 'Yearly targets',
    // Row ids are placeholder organisation unit ids.
    rows: [
        { id: 'OrgUnitA01', label: 'Hospital A' },
        { id: 'OrgUnitB02', label: 'Clinic B' },
        { id: 'OrgUnitC03', label: 'Clinic C' },
    ],
    columns: YEARS.map((year) => ({ id: year, label: year })),
    headerRows: [YEARS.map((year) => ({ id: year, label: year, span: 1 }))],
    closed: new Map(),
}

// Every cell is a positive whole number, whatever its key, so one field serves the whole grid.
const FIELDS = new Map([['target', { valueType: 'INTEGER_POSITIVE' }]])

const SETTINGS = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const

// A store that never changes: nothing here has a rule to say anything about a cell.
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
    const engine = useDataEngine()
    const [log, setLog] = useState<string[]>([])
    const cells = useMemo(
        () =>
            createCellStore({
                fields: FIELDS,
                fieldIdOf: () => 'target',
                values: new Map(),
                settings: SETTINGS,
                annotations,
                // Where a committed value goes: save it to your backend here.
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
            engine={engine}
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

export default TargetsGrid
