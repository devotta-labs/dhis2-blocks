import {
    DataEntry,
    DataEntrySummary,
    DataGrid,
    registerSource,
    useDataEntry,
} from '@/components/data-entry'
import type { RegisterLayout } from '@/components/data-entry'
import {
    ContextSelector,
    OrganisationUnitSelector,
} from '@/components/context-selector'
import type { Option } from '@/components/context-selector'
import { useMemo, useState } from 'react'

/**
 * A child immunisation register: one child a row, a date for each dose.
 *
 * `ImmReg00001` is the "Child immunisation register" program the docs
 * database is seeded with. Its one repeatable stage, `ImmVaccin01`, holds a
 * vaccination per event, with data elements Vaccine (`ImmVaccine1`: BCG, OPV,
 * DPT, MEASLES) and Dose (`ImmDose0001`: 0 to 3). "DPT 2" is the event of
 * that stage whose Vaccine is DPT and Dose is 2, so each date column is a
 * `where` slot: typing the date makes that event, with the vaccine and dose no
 * column shows. Replace the ids with ones from your own instance; the children
 * were enrolled at Ngelehun CHC (`DiszpKrYNg8`) in October 2026.
 */

const STAGE = 'ImmVaccin01'

// One date column for a dose: the vaccination event of this vaccine and dose.
const dose = (vaccine: string, dose: string, label = dose) => ({
    field: {
        stage: STAGE,
        where: { ImmVaccine1: vaccine, ImmDose0001: dose },
        eventDate: true as const,
    },
    label,
})

// The paper's headings, in the paper's order.
export const layout: RegisterLayout = {
    programId: 'ImmReg00001',
    columns: [
        {
            group: 'Child',
            children: [
                { field: { attribute: 'w75KJ2mc4zz' } },
                { field: { attribute: 'zDhUuAYrxNC' } },
                { field: { attribute: 'gHGyrwKPzej' } },
                { field: { attribute: 'cejWyOfXge6' } },
            ],
        },
        {
            group: 'Registered',
            children: [{ field: { enrollment: 'enrolledAt' }, label: 'Date' }],
        },
        { group: 'BCG', children: [dose('BCG', '0', 'Dose 0')] },
        {
            group: 'OPV',
            children: [dose('OPV', '1'), dose('OPV', '2'), dose('OPV', '3')],
        },
        {
            group: 'DPT',
            children: [dose('DPT', '1'), dose('DPT', '2'), dose('DPT', '3')],
        },
        { group: 'Measles', children: [dose('MEASLES', '1', 'Dose 1')] },
    ],
}

// Whole months written out, so the example does no calendar maths of its own.
const months = [
    {
        value: '2026-01',
        label: 'January 2026',
        from: '2026-01-01',
        to: '2026-01-31',
    },
    {
        value: '2026-02',
        label: 'February 2026',
        from: '2026-02-01',
        to: '2026-02-28',
    },
    {
        value: '2026-03',
        label: 'March 2026',
        from: '2026-03-01',
        to: '2026-03-31',
    },
    {
        value: '2026-04',
        label: 'April 2026',
        from: '2026-04-01',
        to: '2026-04-30',
    },
    {
        value: '2026-05',
        label: 'May 2026',
        from: '2026-05-01',
        to: '2026-05-31',
    },
    {
        value: '2026-06',
        label: 'June 2026',
        from: '2026-06-01',
        to: '2026-06-30',
    },
    {
        value: '2026-07',
        label: 'July 2026',
        from: '2026-07-01',
        to: '2026-07-31',
    },
    {
        value: '2026-08',
        label: 'August 2026',
        from: '2026-08-01',
        to: '2026-08-31',
    },
    {
        value: '2026-09',
        label: 'September 2026',
        from: '2026-09-01',
        to: '2026-09-30',
    },
    {
        value: '2026-10',
        label: 'October 2026',
        from: '2026-10-01',
        to: '2026-10-31',
    },
    {
        value: '2026-11',
        label: 'November 2026',
        from: '2026-11-01',
        to: '2026-11-30',
    },
    {
        value: '2026-12',
        label: 'December 2026',
        from: '2026-12-01',
        to: '2026-12-31',
    },
    {
        value: '2027-01',
        label: 'January 2027',
        from: '2027-01-01',
        to: '2027-01-31',
    },
    {
        value: '2027-02',
        label: 'February 2027',
        from: '2027-02-01',
        to: '2027-02-28',
    },
    {
        value: '2027-03',
        label: 'March 2027',
        from: '2027-03-01',
        to: '2027-03-31',
    },
    {
        value: '2027-04',
        label: 'April 2027',
        from: '2027-04-01',
        to: '2027-04-30',
    },
    {
        value: '2027-05',
        label: 'May 2027',
        from: '2027-05-01',
        to: '2027-05-31',
    },
    {
        value: '2027-06',
        label: 'June 2027',
        from: '2027-06-01',
        to: '2027-06-30',
    },
    {
        value: '2027-07',
        label: 'July 2027',
        from: '2027-07-01',
        to: '2027-07-31',
    },
    {
        value: '2027-08',
        label: 'August 2027',
        from: '2027-08-01',
        to: '2027-08-31',
    },
    {
        value: '2027-09',
        label: 'September 2027',
        from: '2027-09-01',
        to: '2027-09-30',
    },
    {
        value: '2027-10',
        label: 'October 2027',
        from: '2027-10-01',
        to: '2027-10-31',
    },
    {
        value: '2027-11',
        label: 'November 2027',
        from: '2027-11-01',
        to: '2027-11-30',
    },
    {
        value: '2027-12',
        label: 'December 2027',
        from: '2027-12-01',
        to: '2027-12-31',
    },
]

const orgUnits: readonly Option[] = [
    { value: 'DiszpKrYNg8', label: 'Ngelehun CHC' },
    { value: 'g8upMTyEZGZ', label: 'Njandama MCHP' },
    { value: 'm7fBMpmVpSM', label: 'Kolisokor MCHP' },
]

// Replace with your app's loading and error states.
const Status = () => {
    const status = useDataEntry((view) => view.status)

    return status === 'ready' ? null : (
        <p role="status" className="text-sm text-dhis2-grey-700">
            {status === 'loading' ? 'Loading…' : 'The form could not be loaded'}
        </p>
    )
}

const ImmunisationRegister = () => {
    const [orgUnitId, setOrgUnitId] = useState('DiszpKrYNg8')
    const [monthValue, setMonthValue] = useState('2026-10')
    const [open, setOpen] = useState(false)
    const month = months.find(({ value }) => value === monthValue) ?? months[0]
    const orgUnit = orgUnits.find(({ value }) => value === orgUnitId)

    // A new source, with new keys, loads the register again: make one per choice, not per render.
    const source = useMemo(
        () =>
            registerSource({
                programId: 'ImmReg00001',
                orgUnitId,
                enrolledFrom: month.from,
                enrolledTo: month.to,
                layout,
            }),
        [orgUnitId, month]
    )

    return (
        <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
                <ContextSelector ariaLabel="Register context">
                    <OrganisationUnitSelector
                        value={orgUnit?.label}
                        open={open}
                        onOpenChange={setOpen}
                    >
                        <ul className="m-0 list-none p-2">
                            {orgUnits.map(({ value, label }) => (
                                <li key={value}>
                                    <button
                                        type="button"
                                        className="w-full cursor-pointer rounded border-none bg-transparent px-2 py-1.5 text-left text-sm hover:bg-[#f3f5f7]"
                                        onClick={() => {
                                            setOrgUnitId(value)
                                            setOpen(false)
                                        }}
                                    >
                                        {label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </OrganisationUnitSelector>
                </ContextSelector>
                <label className="flex items-center gap-2 text-sm">
                    Month
                    <select
                        value={monthValue}
                        onChange={(event) => setMonthValue(event.target.value)}
                    >
                        {months.map(({ value, label }) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <DataEntry source={source}>
                <Status />
                <DataGrid />
                <DataEntrySummary />
            </DataEntry>
        </>
    )
}

export default ImmunisationRegister
