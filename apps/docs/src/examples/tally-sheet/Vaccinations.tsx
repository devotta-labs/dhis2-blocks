import { useState } from 'react'
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/dhis2/ui/table'
import {
    TallySheet,
    tallyCounts,
    type TallyEntry,
    type TallyLayout,
    type TallyOptions,
} from '@/components/tally-sheet'

const VACCINATIONS: TallyLayout = {
    categories: [
        {
            id: 'age',
            label: 'Age',
            options: [
                { id: 'under1', label: '0–11 months' },
                { id: 'over1', label: '12–23 months' },
            ],
        },
        {
            id: 'sex',
            label: 'Sex',
            options: [
                { id: 'female', label: 'Female' },
                { id: 'male', label: 'Male' },
            ],
        },
    ],
    rows: [
        { id: 'bcg', label: 'BCG', group: 'At birth' },
        { id: 'opv0', label: 'OPV 0', group: 'At birth' },
        { id: 'opv1', label: 'OPV 1', group: '6 weeks' },
        { id: 'penta1', label: 'Penta 1', group: '6 weeks' },
        { id: 'opv2', label: 'OPV 2', group: '10 weeks' },
        { id: 'penta2', label: 'Penta 2', group: '10 weeks' },
        { id: 'measles1', label: 'Measles 1', group: '9 months' },
    ],
    closed: [
        { row: 'bcg', options: { age: 'over1' } },
        { row: 'opv0', options: { age: 'over1' } },
    ],
}

const rowLabel = (row: string) =>
    VACCINATIONS.rows.find(({ id }) => id === row)?.label ?? row

const optionLabels = (options: TallyOptions) =>
    VACCINATIONS.categories
        .map(
            ({ id, options: choices }) =>
                choices.find((choice) => choice.id === options[id])?.label
        )
        .join(', ')

const Vaccinations = () => {
    const [log, setLog] = useState<readonly TallyEntry[]>([])
    const counted = tallyCounts(VACCINATIONS, log).filter(
        ({ count }) => count > 0
    )

    return (
        <div className="flex flex-col gap-6">
            <TallySheet
                layout={VACCINATIONS}
                label="Immunisation tally"
                entries={log}
                onAppend={(made) => setLog((before) => [...before, ...made])}
            />
            <Table>
                <TableCaption>Data values</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead>Data element</TableHead>
                        <TableHead>Options</TableHead>
                        <TableHead className="text-end">Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {counted.map(({ row, options, count }) => (
                        <TableRow key={`${row} ${optionLabels(options)}`}>
                            <TableCell>{rowLabel(row)}</TableCell>
                            <TableCell>{optionLabels(options)}</TableCell>
                            <TableCell className="text-end tabular-nums">
                                {count}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

/**
 * An example: a vaccination session by age and sex, its doses grouped by schedule, with birth doses closed after 12
 * months. The log is kept in React state, and the table lists what it adds up to.
 *
 * Save the log where your app keeps a session (local storage, IndexedDB, a data store namespace), and post the
 * counts as data values, each options set mapped to its category option combination.
 */
export default Vaccinations
