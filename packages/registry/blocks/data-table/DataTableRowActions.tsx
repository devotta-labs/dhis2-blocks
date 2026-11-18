import i18n from '@dhis2/d2-i18n'
import { IconMore16 } from '@dhis2/ui-icons'
import { Button } from '@/components/dhis2/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/dhis2/ui/dropdown-menu'
import type { ReactNode } from 'react'

export interface DataTableRowActionsProps {
    /** Accessible name of the trigger. Default: "Row actions". */
    label?: string
    /** `DropdownMenuItem` elements. */
    children: ReactNode
}

/** A "more" button that opens a menu of actions for one row. */
export const DataTableRowActions = ({
    label,
    children,
}: DataTableRowActionsProps) => (
    <DropdownMenu>
        <DropdownMenuTrigger
            data-slot="data-table-row-actions"
            aria-label={label ?? i18n.t('Row actions')}
            render={<Button variant="ghost" size="icon-sm" />}
        >
            <IconMore16 />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
)
