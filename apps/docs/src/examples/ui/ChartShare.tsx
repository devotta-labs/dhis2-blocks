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
    // DHIS2 blue-600, teal-400, yellow-500 and grey-500.
    under5: { label: 'Under 5', color: '#147cd7' },
    child: { label: '5 to 14', color: '#009688' },
    adult: { label: '15 to 59', color: '#ff9302' },
    older: { label: '60 and over', color: '#a0adba' },
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
