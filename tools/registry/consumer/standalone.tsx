import { createRoot } from 'react-dom/client'
import {
    Calendar,
    CalendarNavigation,
    CalendarGrid,
    CalendarDayRecords,
} from '@/components/calendar'
import { Line, LineChart } from 'recharts'
import { Badge } from '@/components/dhis2/ui/badge'
import { Button } from '@/components/dhis2/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/dhis2/ui/card'
import { ChartContainer } from '@/components/dhis2/ui/chart'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import {
    Combobox,
    ComboboxChipsTrigger,
    ComboboxChips,
    ComboboxChip,
    ComboboxContent,
    ComboboxInput,
    ComboboxList,
    ComboboxItem,
} from '@/components/dhis2/ui/combobox'
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
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import { Switch } from '@/components/dhis2/ui/switch'
import { Toggle } from '@/components/dhis2/ui/toggle'
import { Host } from './host'
import './index.css'

const root = document.getElementById('root')
if (root !== null) {
    createRoot(root).render(
        <>
            <Host />
            <Combobox items={['Choice']} multiple defaultValue={['Choice']}>
                <ComboboxChipsTrigger aria-label="Standalone choices">
                    <ComboboxChips>
                        <ComboboxChip removeLabel="Remove Choice">
                            Choice
                        </ComboboxChip>
                    </ComboboxChips>
                </ComboboxChipsTrigger>
                <ComboboxContent>
                    <ComboboxInput aria-label="Filter choices" />
                    <ComboboxList>
                        {(value: string) => (
                            <ComboboxItem key={value} value={value}>
                                {value}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
            <Calendar
                records={[{ id: 'task', date: '2026-11-14', label: 'Launch' }]}
            >
                <CalendarNavigation />
                <CalendarGrid />
                <CalendarDayRecords />
            </Calendar>
            <Card>
                <CardHeader>
                    <CardTitle>Standalone shared controls</CardTitle>
                    <CardDescription>
                        No Working List dependencies
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-4">
                    <Button>Action</Button>
                    <Badge>Badge</Badge>
                    <Skeleton className="h-4 w-24" />
                    <ChartContainer
                        config={{ value: { label: 'Value' } }}
                        className="h-10 w-40"
                    >
                        <LineChart data={[{ value: 1 }, { value: 2 }]}>
                            <Line dataKey="value" />
                        </LineChart>
                    </ChartContainer>
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
