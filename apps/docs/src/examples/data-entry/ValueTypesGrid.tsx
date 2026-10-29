import {
    DataEntry,
    DataEntrySummary,
    DataGrid,
    useDataEntry,
    type CellKey,
    type DataEntrySource,
    type GridColumn,
    type LoadedForm,
    type SaveOutcome,
} from '@/components/data-entry'

/**
 * A source of your own, with a column for every value type.
 *
 * Any data can fill the grid: a source loads a form and saves what changes.
 * This one keeps a small form in memory and saves each change there at once;
 * a source for your own backend would send the records to it in `save` and
 * say what became of each. Searching org units and users, and uploading
 * files, still go to the DHIS2 the app is connected to: `DiszpKrYNg8`
 * (Ngelehun CHC) and `admin` exist in the DHIS2 Sierra Leone demo database.
 * A saved file's download and an image's preview do not work here: they read
 * each row as a DHIS2 event and each column as its data element.
 */

const column = (
    id: string,
    label: string,
    valueType: string,
    options?: GridColumn['field']['options']
): GridColumn => ({ id, label, field: { valueType, options } })

const SEVERITY = [
    { code: 'MILD', name: 'Mild' },
    { code: 'MODERATE', name: 'Moderate' },
    { code: 'SEVERE', name: 'Severe' },
]

const SYMPTOMS = [
    { code: 'FEVER', name: 'Fever' },
    { code: 'COUGH', name: 'Cough' },
    { code: 'RASH', name: 'Rash' },
    { code: 'HEADACHE', name: 'Headache' },
]

// Typed in the cell, then edited in a small editor under it, then shown only.
const COLUMNS: GridColumn[] = [
    column('text', 'Text', 'TEXT'),
    column('letter', 'Letter', 'LETTER'),
    column('email', 'Email', 'EMAIL'),
    column('phone', 'Phone number', 'PHONE_NUMBER'),
    column('url', 'URL', 'URL'),
    column('integer', 'Integer', 'INTEGER'),
    column('positive', 'Positive integer', 'INTEGER_POSITIVE'),
    column('negative', 'Negative integer', 'INTEGER_NEGATIVE'),
    column('zeroOrMore', 'Zero or positive', 'INTEGER_ZERO_OR_POSITIVE'),
    column('number', 'Number', 'NUMBER'),
    column('percentage', 'Percentage', 'PERCENTAGE'),
    column('unitInterval', 'Unit interval', 'UNIT_INTERVAL'),
    column('date', 'Date', 'DATE'),
    column('dateTime', 'Date and time', 'DATETIME'),
    column('time', 'Time', 'TIME'),
    column('yesNo', 'Yes/No', 'BOOLEAN'),
    column('yesOnly', 'Yes only', 'TRUE_ONLY'),
    column('severity', 'Option set', 'TEXT', SEVERITY),
    column('longText', 'Long text', 'LONG_TEXT'),
    column('symptoms', 'Multi-select', 'MULTI_TEXT', SYMPTOMS),
    column('age', 'Age', 'AGE'),
    column('coordinate', 'Coordinate', 'COORDINATE'),
    column('orgUnit', 'Organisation unit', 'ORGANISATION_UNIT'),
    column('username', 'Username', 'USERNAME'),
    column('file', 'File', 'FILE_RESOURCE'),
    column('image', 'Image', 'IMAGE'),
    column('associate', 'Tracker associate', 'TRACKER_ASSOCIATE'),
    column('reference', 'Reference', 'REFERENCE'),
    column('geoJson', 'GeoJSON', 'GEOJSON'),
]

// Values as DHIS2 stores them: ISO dates, option codes, `[lng,lat]`, ids.
const SAMPLES = {
    row1: {
        text: 'Outreach visit',
        letter: 'A',
        email: 'nurse@example.org',
        phone: '+232 76 123456',
        url: 'https://dhis2.org',
        integer: '-4',
        positive: '12',
        negative: '-3',
        zeroOrMore: '0',
        number: '36.6',
        percentage: '85',
        unitInterval: '0.25',
        date: '2026-03-14',
        dateTime: '2026-03-14T09:30:00.000',
        time: '09:30',
        yesNo: 'true',
        yesOnly: 'true',
        severity: 'MODERATE',
        longText: 'Seen at home.\nFollow up in two weeks.',
        symptoms: 'FEVER,RASH',
        age: '1991-07-02',
        coordinate: '[-13.234,8.484]',
        orgUnit: 'DiszpKrYNg8',
        username: 'admin',
        associate: 'vOxUH373fy5',
        reference: 'ZcBPrXKahq2',
        geoJson: '{"type":"Point","coordinates":[-13.234,8.484]}',
    },
    row2: {
        text: 'Clinic visit',
        integer: '7',
        yesNo: 'false',
        severity: 'SEVERE',
        longText: 'No concerns.',
        symptoms: 'COUGH',
        age: '2019-11-20',
    },
    row3: {},
} satisfies Record<string, Record<string, string>>

// Kept for as long as the page is open: a form loaded again shows what was saved.
const stored = new Map(
    Object.entries(SAMPLES).flatMap(([row, values]) =>
        Object.entries(values).map(([field, value]): [CellKey, string] => [
            `${row}.${field}`,
            value,
        ])
    )
)

const formOf = (values: ReadonlyMap<CellKey, string>): LoadedForm => ({
    tables: [
        {
            id: 'samples',
            title: 'Every value type',
            rows: Object.keys(SAMPLES).map((id, at) => ({
                id,
                label: `Row ${at + 1}`,
            })),
            columns: COLUMNS,
            headerRows: [
                COLUMNS.map(({ id, label }) => ({ id, label, span: 1 })),
            ],
            closed: new Map(),
        },
    ],
    values,
    // Nothing required, no sections, no stages to block entry, no rules.
    required: new Map(),
    strategy: new Map(),
    sections: new Map(),
    readOnlyRows: new Map(),
    canReopen: new Set(),
    readOnlyWhenCompleted: new Map(),
    mayUncomplete: false,
    closedByStage: new Map(),
    // An org unit cell shows the name of the id it holds.
    orgUnitNames: new Map([['DiszpKrYNg8', 'Ngelehun CHC']]),
    fileNames: new Map(),
    hasMore: false,
})

// Made once, outside the component: a source with a new key loads the form again.
const inMemory: DataEntrySource = {
    key: 'value-types',
    load: async () => formOf(new Map(stored)),
    save: async (_engine, records) =>
        records.map(({ sourceKey, key, value }): SaveOutcome => {
            if (value === null) {
                stored.delete(key)
            } else {
                stored.set(key, value)
            }
            return { sourceKey, key, result: 'saved' }
        }),
    // Rows here are never completed, and none is added.
    setStatus: async () => [],
    restoreRows: async () => [],
}

// Replace with your app's loading and error states.
const Status = () => {
    const status = useDataEntry((view) => view.status)

    return status === 'ready' ? null : (
        <p role="status" className="text-sm text-dhis2-grey-700">
            {status === 'loading' ? 'Loading…' : 'The form could not be loaded'}
        </p>
    )
}

const ValueTypesGrid = () => (
    <DataEntry source={inMemory}>
        <Status />
        <DataGrid />
        <DataEntrySummary />
    </DataEntry>
)

export default ValueTypesGrid
