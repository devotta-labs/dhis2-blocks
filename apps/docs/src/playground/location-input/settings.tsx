import { Check, Section, SegmentedRow, SelectRow } from '../controls'
import type { LabSettings } from './labData'
import { captureOf } from './labState'

interface Props {
    settings: LabSettings
    onChange: (changes: Partial<LabSettings>) => void
}

/** Which use of the blocks is on show, and what it captures. */
export const ViewControls = ({ settings, onChange }: Props) => (
    <Section title="Block">
        <SelectRow
            label="Shows"
            value={settings.view}
            options={[
                ['input', 'Location input'],
                ['map', 'Location map'],
                ['event', 'Event geometry'],
            ]}
            onChange={(view) => onChange({ view })}
        />
        {settings.view === 'event' ? (
            <SelectRow
                label="Stage featureType"
                value={settings.featureType}
                options={[
                    ['POINT', 'POINT'],
                    ['POLYGON', 'POLYGON'],
                    ['MULTI_POLYGON', 'MULTI_POLYGON'],
                    ['NONE', 'NONE'],
                ]}
                onChange={(featureType) => onChange({ featureType })}
            />
        ) : (
            <SegmentedRow
                label="Captures"
                value={settings.capture}
                options={[
                    ['point', 'Point'],
                    ['area', 'Area'],
                ]}
                onChange={(capture) => onChange({ capture })}
            />
        )}
    </Section>
)

/** What is recorded, what it is checked against, and whether it can change. */
export const ValueControls = ({ settings, onChange }: Props) => {
    const kind = captureOf(settings)
    return (
        <Section title="Value">
            {kind === undefined ? null : (
                <SelectRow
                    label="Recorded"
                    value={settings.start}
                    options={
                        kind === 'point'
                            ? [
                                  ['empty', 'Nothing'],
                                  ['stored', 'A point'],
                                  ['far', 'A swapped point'],
                              ]
                            : [
                                  ['empty', 'Nothing'],
                                  ['stored', 'An area'],
                                  ['holed', 'An area with a hole'],
                              ]
                    }
                    onChange={(start) => onChange({ start })}
                />
            )}
            <SelectRow
                label="Org unit"
                value={settings.orgUnit}
                options={[
                    ['facility', 'A point'],
                    ['district', 'An area'],
                    ['none', 'No geometry'],
                ]}
                onChange={(orgUnit) => onChange({ orgUnit })}
            />
            <Check
                checked={settings.check}
                onChange={(check) => onChange({ check })}
            >
                Warn when far from the org unit
            </Check>
            <Check
                checked={settings.readOnly}
                onChange={(readOnly) => onChange({ readOnly })}
            >
                Read-only
            </Check>
        </Section>
    )
}

/** The map's background and search. */
export const MapControls = ({ settings, onChange }: Props) => (
    <Section title="Map">
        <SelectRow
            label="Background"
            value={settings.tiles}
            options={[
                ['osm', 'OpenStreetMap'],
                ['failing', 'Tiles fail to load'],
                ['none', 'None'],
            ]}
            onChange={(tiles) => onChange({ tiles })}
        />
        <Check
            checked={settings.search}
            onChange={(search) => onChange({ search })}
        >
            Place search (OpenStreetMap)
        </Check>
    </Section>
)

/** Where "my location" comes from. */
export const DeviceControls = ({ settings, onChange }: Props) => (
    <Section title="Device location">
        <SelectRow
            label="Answers with"
            value={settings.device}
            options={[
                ['walk', 'A walk round a field'],
                ['poor', 'A walk, poor signal'],
                ['real', 'This device'],
                ['blocked', 'Permission denied'],
            ]}
            onChange={(device) => onChange({ device })}
        />
    </Section>
)
