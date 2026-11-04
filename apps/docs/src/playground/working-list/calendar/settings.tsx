import { Section, SelectRow } from '../../controls'
import type { LabServer, LabView } from './labData'

type Weekend = 'none' | LabView['weekendColumns']

/** The few settings worth changing by hand; the examples cover the rest. `server` is left out on live DHIS2. */
export const OptionsControls = ({
    server,
    view,
    onServerChange,
    onViewChange,
}: {
    server?: LabServer
    view: LabView
    onServerChange: (server: LabServer) => void
    onViewChange: (view: LabView) => void
}) => {
    const weekend: Weekend =
        view.weekend === 'none' ? 'none' : view.weekendColumns
    return (
        <Section title="Options">
            {server && (
                <SelectRow
                    label="Calendar"
                    value={server.calendar}
                    options={[
                        ['gregorian', 'Gregorian'],
                        ['ethiopian', 'Ethiopian'],
                        ['nepali', 'Nepali'],
                        ['islamic', 'Islamic'],
                        ['persian', 'Persian'],
                        ['thai', 'Thai'],
                    ]}
                    onChange={(calendar) =>
                        onServerChange({ ...server, calendar })
                    }
                />
            )}
            <SelectRow
                label="Weekend"
                value={weekend}
                options={[
                    ['none', 'Not marked'],
                    ['show', 'Shaded'],
                    ['narrow', 'Narrow'],
                    ['hide', 'Hidden'],
                ]}
                onChange={(next) =>
                    onViewChange(
                        next === 'none'
                            ? {
                                  ...view,
                                  weekend: 'none',
                                  weekendColumns: 'show',
                              }
                            : {
                                  ...view,
                                  weekend: 'satSun',
                                  weekendColumns: next,
                              }
                    )
                }
            />
            <SelectRow
                label="With a table"
                value={view.layout}
                options={[
                    ['calendar', 'No'],
                    ['both', 'Side by side'],
                    ['toggle', 'Toggled'],
                ]}
                onChange={(layout) => onViewChange({ ...view, layout })}
            />
        </Section>
    )
}
