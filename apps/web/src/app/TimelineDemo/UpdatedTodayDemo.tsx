import { Timeline } from '@dhis2-blocks/timeline'
import {
    TimelineDhis2Provider,
    useSystemCalendar,
    useTimelineClient,
    type EventEntryData,
} from '@dhis2-blocks/timeline/dhis2'
import React, { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { DEFAULT_PROGRAM, HistoryFeed } from './CaseHistoryDemo'
import { ParamsForm } from './ParamsForm'
import { updatedTodaySource } from './updatedTodaySource'

// Capture's demo database: Ngelehun CHC, where the e2e seed records its events.
const DEFAULT_ORG_UNIT = 'DiszpKrYNg8'

const pad = (value: number) => value.toString().padStart(2, '0')

/** The viewer's local day as `YYYY-MM-DD`. */
const localDay = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const UpdatedToday = ({
    program,
    orgUnit,
}: {
    program: string
    orgUnit: string
}) => {
    const client = useTimelineClient()
    const calendar = useSystemCalendar()
    const today = localDay(new Date())
    const source = useMemo(
        () => updatedTodaySource({ client, program, orgUnit, today }),
        [client, program, orgUnit, today]
    )
    return (
        <Timeline<EventEntryData>
            sources={[source]}
            calendar={calendar}
            locale={i18n.language}
        >
            <TimelineDhis2Provider program={program}>
                <HistoryFeed />
            </TimelineDhis2Provider>
        </Timeline>
    )
}

export const UpdatedTodayDemo = () => {
    const [params] = useSearchParams()
    const program = params.get('program') ?? DEFAULT_PROGRAM
    const orgUnit = params.get('orgUnit') ?? DEFAULT_ORG_UNIT
    return (
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
            <header className="flex flex-col gap-3">
                <h1 className="m-0 text-xl font-medium">
                    {i18n.t('Events updated today')}
                </h1>
                <ParamsForm
                    submitLabel={i18n.t('Show events')}
                    fields={[
                        {
                            name: 'program',
                            label: i18n.t('Program ID'),
                            value: program,
                        },
                        {
                            name: 'orgUnit',
                            label: i18n.t('Organisation unit ID'),
                            value: orgUnit,
                        },
                    ]}
                />
            </header>
            <UpdatedToday
                key={`${program}:${orgUnit}`}
                program={program}
                orgUnit={orgUnit}
            />
        </main>
    )
}
