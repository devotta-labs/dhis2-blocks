import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/dhis2/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

const visits = [
    { month: 'May', first: 186, fourth: 112 },
    { month: 'Jun', first: 205, fourth: 128 },
    { month: 'Jul', first: 174, fourth: 119 },
    { month: 'Aug', first: 221, fourth: 141 },
    { month: 'Sep', first: 238, fourth: 156 },
    { month: 'Oct', first: 213, fourth: 162 },
]

const config = {
    first: { label: 'ANC 1st visit', color: 'var(--dhis2-info-indicator)' },
    fourth: { label: 'ANC 4th visit', color: 'var(--dhis2-success-indicator)' },
} satisfies ChartConfig

/** Antenatal visits per month, as bars side by side, with a tooltip and a legend. */
const ChartVisits = () => (
    <ChartContainer config={config} className="h-72 w-full">
        <BarChart data={visits}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="first" fill="var(--color-first)" radius={2} />
            <Bar dataKey="fourth" fill="var(--color-fourth)" radius={2} />
        </BarChart>
    </ChartContainer>
)

export default ChartVisits
