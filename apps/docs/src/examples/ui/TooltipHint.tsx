import { Button } from '@/components/dhis2/ui/button'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/dhis2/ui/tooltip'

/** A short hint that appears when the button is hovered or focused. */
const TooltipHint = () => (
    <div className="flex gap-2">
        <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>
                Sync
            </TooltipTrigger>
            <TooltipContent>Last synced 5 minutes ago</TooltipContent>
        </Tooltip>
        <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>
                Share
            </TooltipTrigger>
            <TooltipContent side="bottom">
                Share this view with other users
            </TooltipContent>
        </Tooltip>
    </div>
)

export default TooltipHint
