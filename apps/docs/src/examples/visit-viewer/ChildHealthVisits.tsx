import { Button } from '@/components/dhis2/ui/button'
import {
    VisitDate,
    VisitFact,
    VisitFactLabel,
    VisitFacts,
    VisitFactValue,
    VisitItem,
    VisitItemActions,
    VisitItemBody,
    VisitItemContent,
    VisitItemHeader,
    VisitItemTitle,
    VisitItemTrigger,
    VisitList,
    VisitMeta,
    VisitNote,
    VisitNoteMeta,
    VisitNotes,
    VisitNoteText,
    VisitService,
    VisitServices,
    VisitStatus,
    VisitViewer,
    VisitViewerActions,
    VisitViewerDescription,
    VisitViewerEmpty,
    VisitViewerGroup,
    VisitViewerGroupLabel,
    VisitViewerHeader,
    VisitViewerTitle,
    type VisitFactState,
    type VisitStatusVariant,
} from '@/components/visit-viewer'

type Phase = 'overdue' | 'upcoming' | 'past'

interface Fact {
    label: string
    value?: string
    state?: VisitFactState
}

interface Visit {
    id: string
    phase: Phase
    name: string
    date: string
    status: VisitStatusVariant
    services: { name: string; status?: VisitStatusVariant }[]
    place: string
    worker?: string
    facts: Fact[]
    notes: { id: string; author: string; at: string; text: string }[]
}

const visits: Visit[] = [
    {
        id: 'visit-9m',
        phase: 'overdue',
        name: '9-month visit',
        date: '2026-10-28',
        status: 'overdue',
        services: [
            { name: 'Vaccination', status: 'overdue' },
            { name: 'Growth monitoring', status: 'overdue' },
        ],
        place: 'Ngelehun CHC',
        facts: [],
        notes: [],
    },
    {
        id: 'visit-12m',
        phase: 'upcoming',
        name: '12-month visit',
        date: '2027-01-27',
        status: 'scheduled',
        services: [{ name: 'Vaccination' }, { name: 'Growth monitoring' }],
        place: 'Ngelehun CHC',
        facts: [],
        notes: [],
    },
    {
        id: 'visit-6m',
        phase: 'past',
        name: '6-month visit',
        date: '2026-07-29T10:15:00.000',
        status: 'completed',
        services: [
            { name: 'Vaccination', status: 'completed' },
            { name: 'Growth monitoring', status: 'completed' },
        ],
        place: 'Ngelehun CHC',
        worker: 'Nurse Amina',
        facts: [
            { label: 'Weight', value: '7.4 kg' },
            { label: 'Length', value: '66 cm' },
            { label: 'MUAC', value: '13.8 cm' },
            { label: 'Vaccines given', value: 'Penta 3, OPV 3, PCV 3' },
            { label: 'HIV exposure', state: 'restricted' },
        ],
        notes: [
            {
                id: 'note-1',
                author: 'Nurse Amina',
                at: '2026-07-29T10:40:00.000',
                text: 'Growing well. Mother asked about the measles dose; booked for 9 months.',
            },
        ],
    },
    {
        id: 'visit-14w',
        phase: 'past',
        name: '14-week visit',
        date: '2026-05-06T14:30:00.000',
        status: 'in-progress',
        services: [
            { name: 'Vaccination', status: 'completed' },
            { name: 'Growth monitoring', status: 'skipped' },
        ],
        place: 'Njandama MCHP',
        worker: 'CHW Ibrahim',
        facts: [
            { label: 'Weight', state: 'not-performed' },
            { label: 'MUAC', state: 'missing' },
            { label: 'Vaccines given', value: 'Penta 2, OPV 2, PCV 2' },
        ],
        notes: [
            {
                id: 'note-2',
                author: 'CHW Ibrahim',
                at: '2026-05-06T14:45:00.000',
                text: 'Scale out of order; weigh at the next visit.',
            },
        ],
    },
]

const hasDetails = (visit: Visit) =>
    visit.facts.length > 0 || visit.notes.length > 0

const GROUPS = [
    { phase: 'overdue', label: 'Overdue' },
    { phase: 'upcoming', label: 'Upcoming' },
    { phase: 'past', label: 'Past' },
] as const

const ChildHealthVisits = () => (
    <VisitViewer locale="en-GB" className="p-4">
        <VisitViewerHeader>
            <VisitViewerTitle>Child health visits</VisitViewerTitle>
            <VisitViewerDescription>
                Vaccination and growth monitoring, recorded in separate stages
                and shown as one visit.
            </VisitViewerDescription>
            <VisitViewerActions>
                <Button type="button" size="sm">
                    Schedule visit
                </Button>
            </VisitViewerActions>
        </VisitViewerHeader>
        {visits.length === 0 ? (
            <VisitViewerEmpty>
                <p className="m-0">No visits recorded yet.</p>
            </VisitViewerEmpty>
        ) : (
            GROUPS.map(({ phase, label }) => {
                const inGroup = visits.filter((visit) => visit.phase === phase)
                return inGroup.length === 0 ? null : (
                    <VisitViewerGroup key={phase}>
                        <VisitViewerGroupLabel>{label}</VisitViewerGroupLabel>
                        <VisitList>
                            {inGroup.map((visit) => (
                                <VisitItem
                                    key={visit.id}
                                    status={visit.status}
                                    defaultOpen={visit.id === 'visit-6m'}
                                >
                                    <VisitItemHeader>
                                        <VisitItemTitle>
                                            {visit.name}
                                        </VisitItemTitle>
                                        <VisitDate
                                            value={visit.date}
                                            prefix={
                                                visit.phase === 'past'
                                                    ? undefined
                                                    : 'Due'
                                            }
                                        />
                                        <VisitStatus variant={visit.status} />
                                        {hasDetails(visit) ? (
                                            <VisitItemActions>
                                                <VisitItemTrigger />
                                            </VisitItemActions>
                                        ) : null}
                                    </VisitItemHeader>
                                    <VisitItemBody>
                                        <VisitServices aria-label="Services">
                                            {visit.services.map((service) => (
                                                <VisitService
                                                    key={service.name}
                                                    status={service.status}
                                                >
                                                    {service.name}
                                                </VisitService>
                                            ))}
                                        </VisitServices>
                                        <VisitMeta>
                                            <span>{visit.place}</span>
                                            {visit.worker ===
                                            undefined ? null : (
                                                <span>{visit.worker}</span>
                                            )}
                                            {visit.phase === 'past' ? (
                                                <VisitDate
                                                    value={visit.date}
                                                    showTime
                                                />
                                            ) : null}
                                        </VisitMeta>
                                    </VisitItemBody>
                                    {hasDetails(visit) ? (
                                        <VisitItemContent>
                                            <VisitFacts>
                                                {visit.facts.map((fact) => (
                                                    <VisitFact key={fact.label}>
                                                        <VisitFactLabel>
                                                            {fact.label}
                                                        </VisitFactLabel>
                                                        <VisitFactValue
                                                            state={fact.state}
                                                        >
                                                            {fact.value}
                                                        </VisitFactValue>
                                                    </VisitFact>
                                                ))}
                                            </VisitFacts>
                                            {visit.notes.length === 0 ? null : (
                                                <VisitNotes aria-label="Notes">
                                                    {visit.notes.map((note) => (
                                                        <VisitNote
                                                            key={note.id}
                                                        >
                                                            <VisitNoteMeta>
                                                                <span>
                                                                    {
                                                                        note.author
                                                                    }
                                                                </span>
                                                                <VisitDate
                                                                    value={
                                                                        note.at
                                                                    }
                                                                    showTime
                                                                />
                                                            </VisitNoteMeta>
                                                            <VisitNoteText>
                                                                {note.text}
                                                            </VisitNoteText>
                                                        </VisitNote>
                                                    ))}
                                                </VisitNotes>
                                            )}
                                        </VisitItemContent>
                                    ) : null}
                                </VisitItem>
                            ))}
                        </VisitList>
                    </VisitViewerGroup>
                )
            })
        )}
    </VisitViewer>
)

/**
 * A child's visits as expandable cards, grouped by phase.
 *
 * Each visit combines a vaccination and a growth-monitoring stage. The app
 * owns the array, the grouping and the empty state; the block only lays them
 * out. The visits are fictional, and Schedule visit is illustrative only.
 */
export default ChildHealthVisits
