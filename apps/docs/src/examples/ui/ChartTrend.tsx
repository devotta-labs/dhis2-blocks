import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/dhis2/ui/chart'
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    XAxis,
    YAxis,
} from 'recharts'

const coverage = [
    { month: 'Nov', percent: 61 },
    { month: 'Dec', percent: 58 },
    { month: 'Jan', percent: 64 },
    { month: 'Feb', percent: 67 },
    { month: 'Mar', percent: 71 },
    { month: 'Apr', percent: 69 },
    { month: 'May', percent: 74 },
    { month: 'Jun', percent: 77 },
    { month: 'Jul', percent: 76 },
    { month: 'Aug', percent: 81 },
    { month: 'Sep', percent: 83 },
    { month: 'Oct', percent: 85 },
]

const config = {
    // DHIS2 blue-600.
    percent: { label: 'Penta 3 coverage (%)', color: '#147cd7' },
} satisfies ChartConfig

/** Coverage over twelve months, as a line, against a target of 80%. */
const ChartTrend = () => (
    <ChartContainer config={config} className="h-72 w-full">
        <LineChart data={coverage}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis
                domain={[0, 100]}
                tickFormatter={(value: number) => `${value}%`}
                tickLine={false}
                axisLine={false}
                width={40}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <ReferenceLine
                y={80}
                stroke="#a0adba"
                strokeDasharray="4 4"
                label={{
                    value: 'Target 80%',
                    position: 'insideTopLeft',
                    fill: '#6c7787',
                }}
            />
            <Line
                dataKey="percent"
                stroke="var(--color-percent)"
                strokeWidth={2}
                dot={false}
            />
        </LineChart>
    </ChartContainer>
)

export default ChartTrend
