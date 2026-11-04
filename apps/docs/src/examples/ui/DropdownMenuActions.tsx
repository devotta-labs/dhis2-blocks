import { Button } from '@/components/dhis2/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuTriggerArrow,
} from '@/components/dhis2/ui/dropdown-menu'

/** The less common actions for a record, tucked behind one button. */
const DropdownMenuActions = () => (
    <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
            Actions
            <DropdownMenuTriggerArrow />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
            <DropdownMenuGroup>
                <DropdownMenuLabel>Enrollment</DropdownMenuLabel>
                <DropdownMenuItem>Mark for follow-up</DropdownMenuItem>
                <DropdownMenuItem>
                    Transfer to another facility
                </DropdownMenuItem>
                <DropdownMenuItem>Download as CSV</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Delete enrollment</DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
)

export default DropdownMenuActions
