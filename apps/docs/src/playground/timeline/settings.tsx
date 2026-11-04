import type { EventTimeField } from '@/components/timeline/dhis2'
import { Check, NumberRow, Section, SelectRow } from '../controls'
import { LAB_PROGRAMS, type LabSettings } from './labData'

const TIME_FIELDS: ReadonlyArray<readonly [EventTimeField, string]> = [
    ['occurredAt', 'Event date (occurredAt)'],
    ['scheduledAt', 'Due date (scheduledAt)'],
    ['completedAt', 'Completed (completedAt)'],
    ['createdAt', 'Created (createdAt)'],
    ['updatedAt', 'Updated (updatedAt)'],
]

const LOCALES: ReadonlyArray<readonly [LabSettings['locale'], string]> = [
    ['en', 'English'],
    ['fr', 'French'],
    ['ar', 'Arabic, right to left'],
]

/** The few settings worth changing by hand; the examples cover the rest. */
export const OptionsControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: (changes: Partial<LabSettings>) => void
}) => (
    <>
        <Section title="Record">
            <NumberRow
                label="Programs"
                value={settings.programs}
                max={LAB_PROGRAMS.length}
                onChange={(programs) => onChange({ programs })}
            />
            {LAB_PROGRAMS.slice(0, settings.programs).map((program, index) => (
                <NumberRow
                    key={program.id}
                    label={`Events, ${program.name}`}
                    value={settings.events[index] ?? 0}
                    max={1200}
                    onChange={(count) => {
                        const events: LabSettings['events'] = [
                            ...settings.events,
                        ]
                        events[index] = count
                        onChange({ events })
                    }}
                />
            ))}
            <NumberRow
                label="Upcoming, each"
                value={settings.upcoming}
                max={20}
                onChange={(upcoming) => onChange({ upcoming })}
            />
            <NumberRow
                label="Overdue, each"
                value={settings.overdue}
                max={20}
                onChange={(overdue) => onChange({ overdue })}
            />
            <NumberRow
                label="Skipped, each"
                value={settings.skipped}
                max={20}
                onChange={(skipped) => onChange({ skipped })}
            />
            <Check
                checked={settings.notes}
                onChange={(notes) => onChange({ notes })}
            >
                Notes
            </Check>
            <SelectRow
                label="Changelog"
                value={settings.changelog}
                options={[
                    ['some', 'Some changes'],
                    ['many', 'Past the 500 rows'],
                    ['none', 'Not recorded'],
                    ['unsupported', 'Not found (404)'],
                ]}
                onChange={(changelog) => onChange({ changelog })}
            />
            <SelectRow
                label="Failing part"
                value={settings.failing}
                options={[
                    ['none', 'None'],
                    ['changes', 'Changelogs'],
                    ['metadata', 'Program details'],
                    ['orgUnits', 'Org unit names'],
                    ['events', 'Events'],
                ]}
                onChange={(failing) => onChange({ failing })}
            />
        </Section>
        <DisplayControls settings={settings} onChange={onChange} />
    </>
)

/** The hook's and the timeline's own options; live DHIS2 uses them too. */
export const DisplayControls = ({
    settings,
    onChange,
    live = false,
}: {
    settings: LabSettings
    onChange: (changes: Partial<LabSettings>) => void
    live?: boolean
}) => (
    <Section title="Display">
        <SelectRow
            label="Time field"
            value={settings.timeField}
            options={TIME_FIELDS}
            onChange={(timeField) => onChange({ timeField })}
        />
        {live ? null : (
            <SelectRow
                label="Calendar"
                value={settings.calendar}
                options={[
                    ['gregorian', 'Gregorian'],
                    ['ethiopian', 'Ethiopian'],
                    ['nepali', 'Nepali'],
                    ['islamic', 'Islamic'],
                    ['persian', 'Persian'],
                    ['thai', 'Thai'],
                ]}
                onChange={(calendar) => onChange({ calendar })}
            />
        )}
        <SelectRow
            label="Language"
            value={settings.locale}
            options={LOCALES}
            onChange={(locale) => onChange({ locale })}
        />
        <NumberRow
            label="Show older step"
            value={settings.step}
            min={1}
            max={500}
            onChange={(step) => onChange({ step })}
        />
    </Section>
)
