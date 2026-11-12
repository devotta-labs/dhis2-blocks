import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/dhis2/ui/chart'
import { Pie, PieChart } from 'recharts'

const cases = [
    { age: 'under5', cases: 412, fill: 'var(--color-under5)' },
    { age: 'child', cases: 268, fill: 'var(--color-child)' },
    { age: 'adult', cases: 351, fill: 'var(--color-adult)' },
    { age: 'older', cases: 94, fill: 'var(--color-older)' },
]

const config = {
    cases: { label: 'Cases' },
    under5: { label: 'Under 5', color: 'var(--dhis2-info-indicator)' },
    child: { label: '5 to 14', color: 'var(--dhis2-success-indicator)' },
    adult: { label: '15 to 59', color: 'var(--dhis2-warning-indicator)' },
    older: { label: '60 and over', color: 'var(--dhis2-neutral-indicator)' },
} satisfies ChartConfig

/** Malaria cases by age group, as a donut: each slice's share of the total. */
const ChartShare = () => (
    <ChartContainer config={config} className="mx-auto h-72 w-full max-w-sm">
        <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
                data={cases}
                dataKey="cases"
                nameKey="age"
                innerRadius="55%"
                strokeWidth={2}
            />
            <ChartLegend
                content={<ChartLegendContent nameKey="age" />}
                itemSorter={null}
            />
        </PieChart>
    </ChartContainer>
)

export default ChartShare
