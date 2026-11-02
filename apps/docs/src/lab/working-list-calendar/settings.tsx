import { Check, NumberRow, Section, SelectRow } from './controls'
import type { LabData, LabServer, LabView } from './labData'

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
                label="Records"
                value={server.records}
                options={[
                    ['ok', 'Answer'],
                    ['ignoresWindow', 'Ignore the window'],
                    ['fails', 'Fail (500)'],
                    ['hangs', 'Never answer'],
                ]}
                onChange={(records) => set({ records })}
            />
            <SelectRow
                label="Program metadata"
                value={server.metadata}
                options={[
                    ['ok', 'Answer'],
                    ['fails', 'Fail (500)'],
                ]}
                onChange={(metadata) => set({ metadata })}
            />
            <NumberRow
                label="Latency"
                value={server.latency}
                max={20000}
                suffix="ms"
                onChange={(latency) => set({ latency })}
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
