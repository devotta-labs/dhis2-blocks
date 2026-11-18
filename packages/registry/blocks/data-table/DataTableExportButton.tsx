import i18n from '@dhis2/d2-i18n'
import { IconDownload16 } from '@dhis2/ui-icons'
import { Button } from '@/components/dhis2/ui/button'
import type { RowData } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { downloadDataTableCsv, type DataTableCsvOptions } from './exportCsv'
import { useDataTableInstance } from './tableHook'

export interface DataTableExportButtonProps {
    /** File name with or without `.csv`. */
    filename: string
    rows?: 'all' | 'page' | 'selected'
    /** Cell text, as in `dataTableToCsv`. */
    formatValue?: DataTableCsvOptions<RowData>['formatValue']
    /** Default ','. */
    delimiter?: DataTableCsvOptions<RowData>['delimiter']
    className?: string
    /** Button text. Default: "Download CSV". */
    children?: ReactNode
}

/** Downloads the table's visible columns as CSV. */
export const DataTableExportButton = ({
    filename,
    rows,
    formatValue,
    delimiter,
    className,
    children,
}: DataTableExportButtonProps) => {
    const table = useDataTableInstance()
    return (
        <Button
            type="button"
            variant="secondary"
            size="sm"
            data-slot="data-table-export"
            className={className}
            onClick={() =>
                downloadDataTableCsv(table, filename, {
                    rows,
                    formatValue,
                    delimiter,
                })
            }
        >
            <IconDownload16 />
            {children ?? i18n.t('Download CSV')}
        </Button>
    )
}
