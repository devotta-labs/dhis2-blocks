import { Button } from '@/components/dhis2/ui/button'
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/dhis2/ui/table'
import {
    VisitDate,
    VisitFactValue,
    VisitItemActions,
    VisitService,
    VisitServices,
    VisitStatus,
    VisitViewer,
    type VisitFactState,
    type VisitStatusVariant,
} from '@/components/visit-viewer'

interface Measure {
    value?: string
    state?: VisitFactState
}

interface Visit {
    id: string
    name: string
    date: string
    status: VisitStatusVariant
    services: { name: string; status?: VisitStatusVariant }[]
    weight: Measure
    muac: Measure
}

const visits: Visit[] = [
    {
        id: 'visit-9m',
        name: '9-month visit',
        date: '2026-10-28',
        status: 'overdue',
        services: [{ name: 'Vaccination' }, { name: 'Growth monitoring' }],
        weight: { state: 'missing' },
        muac: { state: 'missing' },
    },
    {
        id: 'visit-6m',
        name: '6-month visit',
        date: '2026-07-29',
        status: 'completed',
        services: [{ name: 'Vaccination' }, { name: 'Growth monitoring' }],
        weight: { value: '7.4 kg' },
        muac: { value: '13.8 cm' },
    },
    {
        id: 'visit-14w',
        name: '14-week visit',
        date: '2026-05-06',
        status: 'in-progress',
        services: [
            { name: 'Vaccination', status: 'completed' },
            { name: 'Growth monitoring', status: 'skipped' },
        ],
        weight: { state: 'not-performed' },
        muac: { state: 'restricted' },
    },
    {
        id: 'visit-10w',
        name: '10-week visit',
        date: '2026-04-08',
        status: 'completed',
        services: [{ name: 'Vaccination' }, { name: 'Growth monitoring' }],
        weight: { value: '5.1 kg' },
        muac: { value: '12.9 cm' },
    },
]

const VisitTable = () => (
    <VisitViewer
        locale="en-GB"
        aria-label="Child health visits"
        className="p-4"
    >
        <Table>
            <TableCaption>Child health visits, newest first</TableCaption>
            <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Visit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>MUAC</TableHead>
                    <TableHead>
                        <span className="sr-only">Actions</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {visits.map((visit) => (
                    <TableRow key={visit.id} data-status={visit.status}>
                        <TableCell>
                            <VisitDate value={visit.date} />
                        </TableCell>
                        <TableCell className="font-medium">
                            {visit.name}
                        </TableCell>
                        <TableCell>
                            <VisitStatus variant={visit.status} />
                        </TableCell>
                        <TableCell>
                            <VisitServices>
                                {visit.services.map((service) => (
                                    <VisitService
                                        key={service.name}
                                        status={service.status}
                                    >
                                        {service.name}
                                    </VisitService>
                                ))}
                            </VisitServices>
                        </TableCell>
                        <TableCell>
                            <VisitFactValue state={visit.weight.state}>
                                {visit.weight.value}
                            </VisitFactValue>
                        </TableCell>
                        <TableCell>
                            <VisitFactValue state={visit.muac.state}>
                                {visit.muac.value}
                            </VisitFactValue>
                        </TableCell>
                        <TableCell>
                            <VisitItemActions>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    aria-label={`Open ${visit.name}`}
                                >
                                    Open
                                </Button>
                            </VisitItemActions>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </VisitViewer>
)

/**
 * The same visits as a table, built from the shared Table primitives.
 *
 * Visit Viewer has no table of its own: put VisitDate, VisitStatus,
 * VisitServices and VisitFactValue in your cells. Outside a VisitFact,
 * VisitFactValue renders a span, so no cell holds a stray `<dd>`. The visits
 * are fictional, and Open is illustrative only.
 */
export default VisitTable
