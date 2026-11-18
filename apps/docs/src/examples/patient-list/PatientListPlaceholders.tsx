import { Skeleton } from '@/components/dhis2/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/dhis2/ui/table'

/**
 * The loading placeholder for the Patient List examples.
 *
 * It belongs to the docs, not the block: it covers the time before an example
 * can mount the block at all — its code loading and the DHIS2 session
 * starting. It copies the layout of the block's own loading state (a toolbar,
 * 10 rows as the examples' page size, and the pagination bar) so the preview
 * does not jump when the block takes over. If the block's layout changes,
 * update this to match.
 */
const PAGE_SIZE = 10

const COLUMN_COUNT = 5

const CELL_WIDTHS = ['w-[46%]', 'w-[62%]', 'w-[34%]', 'w-[54%]', 'w-[40%]']

const CHIP_WIDTHS = ['w-28', 'w-24', 'w-32']

export const PatientListPlaceholder = () => (
    <div className="flex w-full min-w-0 flex-col" aria-busy="true">
        <span className="sr-only" role="status">
            Loading the patient list…
        </span>
        <div className="flex w-full min-w-0 flex-col" aria-hidden="true">
            <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-dhis2-border px-3 py-2">
                {CHIP_WIDTHS.map((width) => (
                    <Skeleton key={width} className={`h-8 ${width}`} />
                ))}
                <Skeleton className="ms-auto h-8 w-24" />
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        {Array.from({ length: COLUMN_COUNT }, (_, column) => (
                            <TableHead key={column}>
                                <Skeleton
                                    className={`h-3 rounded-[3px] ${column % 2 === 0 ? 'w-24' : 'w-20'}`}
                                />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: PAGE_SIZE }, (_, row) => (
                        <TableRow key={row}>
                            {Array.from(
                                { length: COLUMN_COUNT },
                                (_, column) => (
                                    <TableCell key={column}>
                                        <Skeleton
                                            className={`h-3.5 rounded-[3px] ${CELL_WIDTHS[(row * 3 + column) % CELL_WIDTHS.length]}`}
                                        />
                                    </TableCell>
                                )
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-3 py-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-8 w-48" />
            </div>
        </div>
    </div>
)
