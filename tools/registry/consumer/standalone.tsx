import { createRoot } from 'react-dom/client'
import { Button } from '@/components/dhis2/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/dhis2/ui/card'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/dhis2/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/dhis2/ui/dropdown-menu'
import { RadioGroup, RadioGroupItem } from '@/components/dhis2/ui/radio-group'
import { Switch } from '@/components/dhis2/ui/switch'
import { Toggle } from '@/components/dhis2/ui/toggle'
import { Host } from './host'
import './index.css'

const root = document.getElementById('root')
if (root !== null) {
    createRoot(root).render(
        <>
            <Host />
            <Card>
                <CardHeader>
                    <CardTitle>Standalone shared controls</CardTitle>
                    <CardDescription>
                        No Working List dependencies
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-4">
                    <Button>Action</Button>
                    <Checkbox aria-label="Enabled" />
                    <Switch aria-label="Notifications" />
                    <Toggle>Toggle</Toggle>
                    <RadioGroup aria-label="Outcome" defaultValue="a">
                        <RadioGroupItem value="a" aria-label="Alpha" />
                        <RadioGroupItem value="b" aria-label="Beta" />
                    </RadioGroup>
                    <DropdownMenu>
                        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>Menu action</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Dialog>
                        <DialogTrigger>Open dialog</DialogTrigger>
                        <DialogContent>
                            <DialogTitle>Shared dialog</DialogTitle>
                            <DialogDescription>
                                Registry consumer
                            </DialogDescription>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
        </>
    )
}
