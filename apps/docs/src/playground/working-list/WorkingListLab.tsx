import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Section, SegmentedRow } from '../controls'
import { DisplayChoice } from './displayChoice'

type Display = 'table' | 'calendar'

/** Each display's lab, loaded when it is chosen. */
const DISPLAYS = {
    table: lazy(() =>
        import('./table/TableLab').then(({ TableLab }) => ({
            default: TableLab,
        }))
    ),
    calendar: lazy(() =>
        import('./calendar/CalendarLab').then(({ CalendarLab }) => ({
            default: CalendarLab,
        }))
    ),
}

/**
 * The working list lab: its records as a table or on a calendar, a block setting kept in the URL
 * (`?display=calendar`). Each display has its own presets, settings and fake server, so a new choice opens on that
 * display's saved settings, without the last one's preset.
 */
export const WorkingListLab = () => {
    const [params, setParams] = useSearchParams()
    const display: Display =
        params.get('display') === 'calendar' ? 'calendar' : 'table'
    const Lab = DISPLAYS[display]

    return (
        <DisplayChoice.Provider
            value={
                <Section title="Display">
                    <SegmentedRow
                        label="Results"
                        value={display}
                        options={[
                            ['table', 'Table'],
                            ['calendar', 'Calendar'],
                        ]}
                        onChange={(next) =>
                            setParams(next === 'table' ? {} : { display: next })
                        }
                    />
                </Section>
            }
        >
            <Suspense fallback={<div className="h-full bg-muted" />}>
                <Lab key={display} />
            </Suspense>
        </DisplayChoice.Provider>
    )
}
