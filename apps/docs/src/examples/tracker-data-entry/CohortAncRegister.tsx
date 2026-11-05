import { SpreadsheetGrid } from '@/components/spreadsheet'
import {
    TrackerDataEntry,
    TrackerDataEntrySummary,
    registerSource,
    useTrackerDataEntry,
} from '@/components/tracker-data-entry'
import type { RegisterLayout } from '@/components/tracker-data-entry'
import {
    ContextSelector,
    OrganisationUnitSelector,
} from '@/components/context-selector'
import type { Option } from '@/components/context-selector'
import { useMemo, useState } from 'react'

/**
 * A cohort register of antenatal care over the WHO RMNCH Tracker: one woman a row.
 *
 * `WSGAb5XwJ3Y` is the program in the DHIS2 Sierra Leone demo database. Her
 * first visit is the one event of stage `WZbXY0S00lP`; her later visits are
 * the events of the repeatable stage `edqlbukwRfQ` in date order, as the
 * register's 1st, 2nd and 3rd. Replace the ids with ones from your own
 * instance. "Add person" (Ctrl+Enter) enrols a new woman at the organisation
 * unit, with the first visit the program schedules for her. The demo database
 * has five women enrolled at Ngelehun CHC in January 2027.
 */

const FIRST = 'WZbXY0S00lP'
const SECOND = 'edqlbukwRfQ'

// Gestational age, blood pressure, haemoglobin, HIV and RPR tests.
const SECOND_VISIT_ELEMENTS = [
    'roKuXYfw1BW',
    'M4HEOoEFTAT',
    'dyYdfamSY2Z',
    'vANAXwtLwcT',
    'Itl05OEupgQ',
    'AAaJGnWR5js',
]

// The first visit adds to them the haematocrit, dates, proteinuria, presentation, plurality and supplements.
const FIRST_VISIT_ELEMENTS = [
    ...SECOND_VISIT_ELEMENTS,
    'X8HbdaoS9LN',
    'w4ky6EkVahL',
    'DecmCMPDPdS',
    'r3BqzOPxAjp',
    'dpiyZz8bkVE',
    'vPdXnmGWzfy',
    'PN6HcGjTraL',
    'Kb6kZzUCJi1',
    'PKZPVfAJfHD',
]

// A woman's visit as the paper has it: its date, then what was measured.
const firstVisit = (dataElement: string) => ({
    field: { stage: FIRST, dataElement },
})
const secondVisit = (occurrence: number) => ({
    group: `Visit ${occurrence}`,
    children: [
        {
            field: { stage: SECOND, occurrence, eventDate: true as const },
            label: 'Date',
        },
        ...SECOND_VISIT_ELEMENTS.map((dataElement) => ({
            field: { stage: SECOND, occurrence, dataElement },
        })),
    ],
})

export const layout: RegisterLayout = {
    programId: 'WSGAb5XwJ3Y',
    columns: [
        { field: { attribute: 'w75KJ2mc4zz' } },
        { field: { attribute: 'zDhUuAYrxNC' } },
        { field: { attribute: 'gHGyrwKPzej' } },
        { field: { enrollment: 'enrolledAt' } },
        {
            group: 'First antenatal care visit',
            children: [
                { field: { stage: FIRST, eventDate: true }, label: 'Date' },
                ...FIRST_VISIT_ELEMENTS.map(firstVisit),
            ],
        },
        {
            group: 'Second antenatal care visit',
            children: [1, 2, 3].map(secondVisit),
        },
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
    const status = useTrackerDataEntry((view) => view.status)

    return status === 'ready' ? null : (
        <p role="status" className="text-sm text-dhis2-grey-700">
            {status === 'loading' ? 'Loading…' : 'The form could not be loaded'}
        </p>
    )
}

const CohortAncRegister = () => {
    const [orgUnitId, setOrgUnitId] = useState('DiszpKrYNg8')
    const [monthValue, setMonthValue] = useState('2027-01')
    const [open, setOpen] = useState(false)
    const month = months.find(({ value }) => value === monthValue) ?? months[0]
    const orgUnit = orgUnits.find(({ value }) => value === orgUnitId)

    // A new source, with new keys, loads the register again: make one per choice, not per render.
    const source = useMemo(
        () =>
            registerSource({
                programId: 'WSGAb5XwJ3Y',
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
            <TrackerDataEntry source={source}>
                <Status />
                <SpreadsheetGrid />
                <TrackerDataEntrySummary />
            </TrackerDataEntry>
        </>
    )
}

export default CohortAncRegister
