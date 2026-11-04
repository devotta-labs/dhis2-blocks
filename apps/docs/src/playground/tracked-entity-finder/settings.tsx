import { NumberRow, Section, SelectRow } from '../controls'
import { CALENDARS, type LabServer } from './labData'

/** The few settings worth changing by hand; the examples cover the rest. */
export const OptionsControls = ({
    server,
    onChange,
}: {
    server: LabServer
    onChange: (server: LabServer) => void
}) => (
    <Section title="Options">
        <NumberRow
            label="People found"
            value={server.matches}
            max={500}
            onChange={(matches) => onChange({ ...server, matches })}
        />
        <SelectRow
            label="Calendar"
            value={server.calendar}
            options={CALENDARS}
            onChange={(calendar) => onChange({ ...server, calendar })}
        />
    </Section>
)
