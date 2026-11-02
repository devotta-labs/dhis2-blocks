import { Check, NumberRow, Section, SelectRow } from './controls'
import {
    ATTRIBUTES,
    WEIGHT,
    type LabData,
    type LabServer,
    type LabView,
} from './labData'
import { PRESETS, type Preset } from './presets'

/** Fields a chosen-fields label can use: attributes, system dates and a data element. */
const LABEL_FIELDS: ReadonlyArray<readonly [string, string]> = [
    ['', '(none)'],
    [ATTRIBUTES.firstName, 'First name'],
    [ATTRIBUTES.lastName, 'Last name'],
    [ATTRIBUTES.nationalId, 'National ID (unique)'],
    [ATTRIBUTES.sex, 'Sex (option set)'],
    [ATTRIBUTES.location, 'Location (not in list)'],
    ['enrolledAt', 'Enrollment date'],
    ['enrollmentOccurredAt', 'Incident date'],
    ['eventOccurredAt', 'Visit date (events)'],
    ['eventScheduledAt', 'Due date (events)'],
    [WEIGHT, 'Weight (events)'],
    ['createdAt', 'Registration date'],
    ['programOwnerId', 'Owner org unit'],
    ['labUnknown1', 'Unknown field'],
]

const presetGroups = [...new Set(PRESETS.map(({ group }) => group))]

export const PresetControls = ({
    selected,
    onPick,
}: {
    selected?: string
    onPick: (preset: Preset) => void
}) => (
    <Section title="Presets">
        {presetGroups.map((group) => (
            <div key={group} className="flex flex-wrap gap-1">
                <span className="w-full text-[10px] tracking-[0.1em] text-(--lab-ink-3) uppercase">
                    {group}
                </span>
                {PRESETS.filter((each) => each.group === group).map((each) => (
                    <button
                        key={each.name}
                        type="button"
                        title={each.note}
                        aria-pressed={selected === each.name}
                        className="tracking-normal normal-case"
                        onClick={() => onPick(each)}
                    >
                        {each.name}
                    </button>
                ))}
            </div>
        ))}
    </Section>
)

export const DataControls = ({
    data,
    onChange,
}: {
    data: LabData
    onChange: (data: LabData) => void
}) => {
    const set = (changes: Partial<LabData>) => onChange({ ...data, ...changes })
    return (
        <Section title="Data">
            <SelectRow
                label="List"
                value={data.mode}
                options={[
                    ['trackedEntity', 'Enrollments'],
                    ['event', 'Follow-up visits'],
                ]}
                onChange={(mode) => set({ mode })}
            />
            <NumberRow
                label="Records"
                value={data.records}
                max={5000}
                onChange={(records) => set({ records })}
            />
            <NumberRow
                label="Days either side"
                value={data.spanDays}
                max={1000}
                onChange={(spanDays) => set({ spanDays })}
            />
            <SelectRow
                label="Spread"
                value={data.spread}
                options={[
                    ['even', 'Even'],
                    ['clustered', 'Clustered'],
                    ['oneDay', 'All on one day'],
                    ['weekdays', 'Weekdays only'],
                    ['future', 'Future only'],
                    ['past', 'Past only'],
                ]}
                onChange={(spread) => set({ spread })}
            />
            <SelectRow
                label="Names"
                value={data.names}
                options={[
                    ['everyday', 'Everyday'],
                    ['long', 'Long'],
                    ['unicode', 'Unicode and RTL'],
                    ['blank', 'Blank'],
                    ['unnamed', 'Not in the list'],
                ]}
                onChange={(names) => set({ names })}
            />
            <NumberRow
                label="Missing dates"
                value={data.missingDates}
                max={100}
                suffix="%"
                onChange={(missingDates) => set({ missingDates })}
            />
            <NumberRow
                label="Malformed dates"
                value={data.badDates}
                max={100}
                suffix="%"
                onChange={(badDates) => set({ badDates })}
            />
            <NumberRow
                label="Duplicates"
                value={data.duplicates}
                max={100}
                suffix="%"
                onChange={(duplicates) => set({ duplicates })}
            />
            <NumberRow
                label="Locations"
                value={data.locations}
                min={1}
                max={12}
                onChange={(locations) => set({ locations })}
            />
        </Section>
    )
}

export const ServerControls = ({
    server,
    onChange,
}: {
    server: LabServer
    onChange: (server: LabServer) => void
}) => {
    const set = (changes: Partial<LabServer>) =>
        onChange({ ...server, ...changes })
    return (
        <Section title="Server">
            <SelectRow
                label="Calendar"
                value={server.calendar}
                options={[
                    ['gregorian', 'Gregorian'],
                    ['iso8601', 'ISO 8601'],
                    ['ethiopian', 'Ethiopian'],
                    ['nepali', 'Nepali'],
                    ['coptic', 'Coptic'],
                    ['islamic', 'Islamic'],
                    ['persian', 'Persian'],
                    ['thai', 'Thai'],
                ]}
                onChange={(calendar) => set({ calendar })}
            />
            <SelectRow
                label="Date format"
                value={server.dateFormat}
                options={[
                    ['YYYY-MM-DD', 'YYYY-MM-DD'],
                    ['DD-MM-YYYY', 'DD-MM-YYYY'],
                ]}
                onChange={(dateFormat) => set({ dateFormat })}
            />
            <SelectRow
                label="Time zone"
                value={server.timeZone}
                options={[
                    ['Africa/Freetown', 'Freetown (UTC)'],
                    ['Africa/Addis_Ababa', 'Addis Ababa (+3)'],
                    ['Asia/Kathmandu', 'Kathmandu (+5:45)'],
                    ['Pacific/Kiritimati', 'Kiritimati (+14)'],
                    ['Pacific/Pago_Pago', 'Pago Pago (−11)'],
                ]}
                onChange={(timeZone) => set({ timeZone })}
            />
            <SelectRow
                label="Saved view filter"
                value={server.savedFilter}
                options={[
                    ['none', 'None'],
                    ['thisMonth', 'This month'],
                    ['last30', 'Last 30 days'],
                    ['next90', 'Next 90 days'],
                    ['fixedPast', '120 to 60 days ago'],
                ]}
                onChange={(savedFilter) => set({ savedFilter })}
            />
            <SelectRow
                label="Saved view columns"
                value={server.columns}
                options={[
                    ['program', 'Program order'],
                    ['optionFirst', 'Sex (option set) first'],
                    ['locationFirst', 'Location first'],
                    ['idFirst', 'National ID first'],
                ]}
                onChange={(columns) => set({ columns })}
            />
            <SelectRow
                label="Records"
                value={server.records}
                options={[
                    ['ok', 'Answer the window'],
                    ['ignoresWindow', 'Ignore the window'],
                ]}
                onChange={(records) => set({ records })}
            />
            <NumberRow
                label="API version"
                value={server.apiVersion}
                min={38}
                max={44}
                onChange={(apiVersion) => set({ apiVersion })}
            />
        </Section>
    )
}

export const ViewControls = ({
    view,
    onChange,
}: {
    view: LabView
    onChange: (view: LabView) => void
}) => {
    const set = (changes: Partial<LabView>) => onChange({ ...view, ...changes })
    return (
        <Section title="Props and parts">
            <SelectRow
                label="dateField"
                value={view.dateField}
                options={[
                    ['default', '(default)'],
                    ['enrolledAt', 'enrolledAt'],
                    ['enrollmentOccurredAt', 'enrollmentOccurredAt'],
                    ['eventOccurredAt', 'eventOccurredAt'],
                    ['eventScheduledAt', 'eventScheduledAt'],
                ]}
                onChange={(dateField) => set({ dateField })}
            />
            <NumberRow
                label="limit"
                value={view.limit}
                min={1}
                max={5000}
                onChange={(limit) => set({ limit })}
            />
            <SelectRow
                label="Layout"
                value={view.layout}
                options={[
                    ['calendar', 'Calendar'],
                    ['table', 'Table'],
                    ['both', 'Both'],
                    ['toggle', 'Toggle'],
                ]}
                onChange={(layout) => set({ layout })}
            />
            <Check
                checked={view.clickable}
                onChange={(clickable) => set({ clickable })}
            >
                onRecordClick
            </Check>
            <SelectRow
                label="defaultDisplay"
                value={view.display}
                options={[
                    ['counts', 'Counts'],
                    ['records', 'Names'],
                ]}
                onChange={(display) => set({ display })}
            />
            <Check
                checked={view.displayToggle}
                onChange={(displayToggle) => set({ displayToggle })}
            >
                WorkingListCalendarDisplayToggle
            </Check>
            <NumberRow
                label="Names per day (max)"
                value={view.perDay}
                max={20}
                onChange={(perDay) => set({ perDay })}
            />
            <SelectRow
                label="Grid children"
                value={view.cell}
                options={[
                    ['records', 'WorkingListCalendarCellRecords'],
                    ['plainCount', "The lab's own count part"],
                    ['none', 'None'],
                ]}
                onChange={(cell) => set({ cell })}
            />
            <SelectRow
                label="Weekend"
                value={view.weekend}
                options={[
                    ['none', 'None'],
                    ['satSun', 'Saturday and Sunday'],
                    ['friSat', 'Friday and Saturday'],
                    ['sun', 'Sunday only'],
                ]}
                onChange={(weekend) => set({ weekend })}
            />
            <SelectRow
                label="Weekend columns"
                value={view.weekendColumns}
                options={[
                    ['show', 'Show'],
                    ['narrow', 'Narrow'],
                    ['hide', 'Hide'],
                ]}
                onChange={(weekendColumns) => set({ weekendColumns })}
            />
            <SelectRow
                label="recordStatus"
                value={view.recordStatus}
                options={[
                    ['default', '(default: status, overdue)'],
                    ['none', 'Returns undefined'],
                    ['location', 'By location'],
                ]}
                onChange={(recordStatus) => set({ recordStatus })}
            />
            <SelectRow
                label="recordLabel"
                value={view.recordLabel}
                options={[
                    ['default', '(default: visible columns)'],
                    ['fields', 'Chosen fields'],
                    ['blank', 'Returns ""'],
                    ['rowId', 'row.id'],
                ]}
                onChange={(recordLabel) => set({ recordLabel })}
            />
            {view.recordLabel === 'fields' &&
                view.labelFields.map((fieldId, slot) => (
                    <SelectRow
                        key={slot}
                        label={`Label field ${slot + 1}`}
                        value={fieldId}
                        options={LABEL_FIELDS}
                        onChange={(next) => {
                            const labelFields: LabView['labelFields'] = [
                                ...view.labelFields,
                            ]
                            labelFields[slot] = next
                            set({ labelFields })
                        }}
                    />
                ))}
            <Check
                checked={view.controlledDay}
                onChange={(controlledDay) => set({ controlledDay })}
            >
                Controlled selectedDay
            </Check>
            <Check
                checked={view.navigation}
                onChange={(navigation) => set({ navigation })}
            >
                WorkingListCalendarNavigation
            </Check>
            <Check checked={view.grid} onChange={(grid) => set({ grid })}>
                WorkingListCalendarGrid
            </Check>
            <Check
                checked={view.dayRecords}
                onChange={(dayRecords) => set({ dayRecords })}
            >
                WorkingListCalendarDayRecords
            </Check>
            <Check
                checked={view.toolbar}
                onChange={(toolbar) => set({ toolbar })}
            >
                View switcher and toolbar
            </Check>
            <Check
                checked={view.readout}
                onChange={(readout) => set({ readout })}
            >
                useWorkingListCalendar readout
            </Check>
        </Section>
    )
}
