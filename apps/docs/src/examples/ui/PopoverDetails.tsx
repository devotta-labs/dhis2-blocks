import { Button } from '@/components/dhis2/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/components/dhis2/ui/popover'

/** Details about a value, opened on click and closed by clicking away. */
const PopoverDetails = () => (
    <Popover>
        <PopoverTrigger render={<Button variant="outline" />}>
            About this value
        </PopoverTrigger>
        <PopoverContent align="start">
            <PopoverHeader>
                <PopoverTitle>Hemoglobin</PopoverTitle>
                <PopoverDescription>
                    The latest reading, in g/dL, from the ANC visit on 2 Nov
                    2026.
                </PopoverDescription>
            </PopoverHeader>
            <p className="m-0">Normal range for pregnancy: 11 to 15 g/dL.</p>
        </PopoverContent>
    </Popover>
)

export default PopoverDetails
