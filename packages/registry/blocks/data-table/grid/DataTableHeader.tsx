import { TableHeader, TableRow } from '@/components/dhis2/ui/table'
import { useDataTableInstance } from '../tableHook'
import { DataTableColumnHeader } from './DataTableColumnHeader'

/** The column headers: one row per header group. */
export const DataTableHeader = ({ className }: { className?: string }) => {
    const table = useDataTableInstance()
    return (
        <TableHeader data-slot="data-table-header" className={className}>
            {table.getHeaderGroups().map((group, index) => (
                <TableRow key={group.id} aria-rowindex={index + 1}>
                    {group.headers.map((header) => (
                        <DataTableColumnHeader
                            key={header.id}
                            header={header}
                        />
                    ))}
                </TableRow>
            ))}
        </TableHeader>
    )
}
