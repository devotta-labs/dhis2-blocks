import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/dhis2/ui/table'

const people = [
    {
        id: 'p1',
        name: 'Aminata Kamara',
        facility: 'Ngelehun CHC',
        visit: '2 Nov 2026',
    },
    {
        id: 'p2',
        name: 'Ibrahim Sesay',
        facility: 'Bumpe CHC',
        visit: '28 Oct 2026',
    },
    {
        id: 'p3',
        name: 'Fatmata Bangura',
        facility: 'Njandama MCHP',
        visit: '21 Oct 2026',
    },
]

/** A few records in rows and columns, in the DHIS2 table style. */
const TableRecords = () => (
    <Table>
        <TableCaption>People due for a visit</TableCaption>
        <TableHeader>
            <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Facility</TableHead>
                <TableHead>Last visit</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {people.map((person) => (
                <TableRow key={person.id}>
                    <TableCell>{person.name}</TableCell>
                    <TableCell>{person.facility}</TableCell>
                    <TableCell>{person.visit}</TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
)

export default TableRecords
