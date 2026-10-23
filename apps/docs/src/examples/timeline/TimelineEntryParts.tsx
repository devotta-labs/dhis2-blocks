import { TimelineMetaProvider } from '@/components/timeline'
import {
    eventEntry,
    TimelineEventEntry,
    TimelineEventOrgUnit,
    TimelineEventProgram,
    TimelineEventStage,
    TimelineEventStatus,
    TimelineEventValues,
    EventsPageSchema,
    type ProgramInfo,
} from '@/components/timeline-dhis2'

/**
 * One event's parts in a card, outside any timeline.
 *
 * The parts are presentational: they render from the entry and the calendar,
 * so they work wherever `TimelineMetaProvider` is. The event and program
 * below are placeholders shaped like DHIS2's answers; in your app they come
 * from `useEventEntries` or your own requests.
 */
const program: ProgramInfo = {
    id: 'placeholderProgram',
    name: 'Antenatal care',
    attributes: new Map(),
    stages: new Map([
        [
            'placeholderStage',
            {
                id: 'placeholderStage',
                name: 'First visit',
                hideDueDate: false,
                reportDataElementIds: ['weight', 'riskLevel'],
                dataElements: new Map([
                    [
                        'weight',
                        { name: 'Weight (kg)', meta: { valueType: 'NUMBER' } },
                    ],
                    [
                        'riskLevel',
                        {
                            name: 'Risk level',
                            meta: {
                                valueType: 'TEXT',
                                optionSet: {
                                    options: [
                                        { code: 'LOW', displayName: 'Low' },
                                        { code: 'HIGH', displayName: 'High' },
                                    ],
                                },
                            },
                        },
                    ],
                ]),
            },
        ],
    ]),
}

// An answer from `tracker/events`, parsed as the hooks parse it.
const [event] = EventsPageSchema.parse({
    events: [
        {
            event: 'placeholderEvent',
            status: 'COMPLETED',
            program: 'placeholderProgram',
            programStage: 'placeholderStage',
            orgUnit: 'placeholderOrgUnit',
            occurredAt: '2026-10-20T09:30:00.000',
            dataValues: [
                { dataElement: 'weight', value: '61.5' },
                { dataElement: 'riskLevel', value: 'HIGH' },
            ],
        },
    ],
})

const entry = eventEntry(event, {
    timeField: 'occurredAt',
    today: '2026-10-23',
    program,
    orgUnitNames: new Map([['placeholderOrgUnit', 'Ngelehun CHC']]),
})

const TimelineEntryParts = () => (
    <TimelineMetaProvider calendar="iso8601" locale="en">
        <div className="p-6">
            <section className="max-w-sm rounded-lg border border-border p-4">
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                    Latest visit
                </h3>
                <TimelineEventEntry entry={entry}>
                    <span className="flex flex-wrap items-baseline gap-x-2">
                        <TimelineEventStage />
                        <TimelineEventProgram />
                    </span>
                    <TimelineEventStatus />
                    <TimelineEventOrgUnit />
                    <TimelineEventValues />
                </TimelineEventEntry>
            </section>
        </div>
    </TimelineMetaProvider>
)

export default TimelineEntryParts
