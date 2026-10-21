import React, { useRef, useState } from 'react'
import {
    ChartContainer,
    ChartTooltip,
    type ChartConfig,
} from '@/registry/dhis2/ui/chart'
import { cn } from '@/registry/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import { Line, LineChart, YAxis } from 'recharts'
import type { ObservationSeries } from '../use-tracked-entity-observations'
import { useFormatDate } from './calendar'
import { displayValue } from './format'

const DEFAULT_MAX_POINTS = 12
/** Matches the default `h-10` wrapper: the chart's height before it is measured. */
const DEFAULT_CHART_HEIGHT = 40
const MARGIN = 4
/** The gap between the hovered point and the tooltip's bottom edge, in pixels. */
const TOOLTIP_GAP = 6

export interface SparklineProps {
    series: ObservationSeries
    /** Shown after the value in the tooltip, such as `kg`. */
    unit?: string
    /** The most recent readings to plot; 0 plots nothing. */
    maxPoints?: number
    className?: string
}

/** A compact line of the latest numeric readings, with a text summary for screen readers. */
export function Sparkline({
    series,
    unit,
    maxPoints = DEFAULT_MAX_POINTS,
    className,
}: SparklineProps) {
    const formatDate = useFormatDate()
    // Where the hovered point sits, so the tooltip can stand just above it.
    const [anchor, setAnchor] = useState<{
        index: number
        x: number
        y: number
    }>()
    const wrapperRef = useRef<HTMLDivElement>(null)

    const numeric = series.points.filter(
        (point) => point.numericValue !== undefined
    )
    // Not `slice(-maxPoints)`: -0 would keep every reading.
    const plotted = numeric.slice(
        Math.max(0, numeric.length - Math.floor(maxPoints))
    )
    const first = plotted.at(0)
    const last = plotted.at(-1)
    if (first === undefined || last === undefined) {
        return null
    }

    const config: ChartConfig = {
        value: {
            label: series.label,
            color: 'var(--color-dhis2-primary)',
        },
    }
    const data = plotted.map((point) => ({
        value: point.numericValue,
        date: formatDate(point.occurredAt),
        display: [displayValue(series, point, formatDate), unit]
            .filter(Boolean)
            .join(' '),
    }))
    const lastIndex = data.length - 1

    // Fit the readings, not zero up: a weight of 79 to 77 kg would otherwise look flat.
    const values = data.map((entry) => entry.value ?? 0)
    const low = Math.min(...values)
    const high = Math.max(...values)
    const domain: [number, number] =
        low === high ? [low - 1, high + 1] : [low, high]
    // The height is measured, since a className can resize the chart.
    const yFor = (value: number, height: number) =>
        MARGIN +
        ((domain[1] - value) / (domain[1] - domain[0])) * (height - 2 * MARGIN)

    const summary =
        plotted.length === 1
            ? i18n.t('1 reading on {{date}}, latest {{latest}}', {
                  date: formatDate(first.occurredAt),
                  latest: displayValue(series, last, formatDate),
                  interpolation: { escapeValue: false },
              })
            : i18n.t(
                  '{{count}} readings from {{from}} to {{to}}, latest {{latest}}',
                  {
                      count: plotted.length,
                      from: formatDate(first.occurredAt),
                      to: formatDate(last.occurredAt),
                      latest: displayValue(series, last, formatDate),
                      interpolation: { escapeValue: false },
                  }
              )

    return (
        <div ref={wrapperRef} className={cn('h-10 w-full', className)}>
            <span className="sr-only">{summary}</span>
            <ChartContainer
                aria-hidden="true"
                config={config}
                className="aspect-auto h-full w-full"
            >
                <LineChart
                    data={data}
                    margin={{
                        top: MARGIN,
                        right: MARGIN,
                        bottom: MARGIN,
                        left: MARGIN,
                    }}
                    accessibilityLayer={false}
                    onMouseMove={(state) => {
                        const index = Number(state.activeTooltipIndex)
                        const value = data[index]?.value
                        const x = state.activeCoordinate?.x
                        setAnchor(
                            value === undefined || x === undefined
                                ? undefined
                                : {
                                      index,
                                      x,
                                      y:
                                          yFor(
                                              value,
                                              wrapperRef.current
                                                  ?.clientHeight ||
                                                  DEFAULT_CHART_HEIGHT
                                          ) - TOOLTIP_GAP,
                                  }
                        )
                    }}
                    onMouseLeave={() => setAnchor(undefined)}
                >
                    {/* Recharts places the wrapper's top-left corner at the position; the content lifts itself above it. */}
                    <ChartTooltip
                        position={anchor}
                        allowEscapeViewBox={{ x: true, y: true }}
                        // Recharts slides the tooltip in from its last position, the chart's corner on first hover.
                        isAnimationActive={false}
                        content={({ active }) => {
                            const entry = anchor && data[anchor.index]
                            const width = wrapperRef.current?.clientWidth
                            // Left-aligned on the first point, centred midway, right-aligned on the last, so it never runs past the chart.
                            const shift =
                                anchor && width
                                    ? Math.min(Math.max(anchor.x / width, 0), 1)
                                    : 0.5
                            return active && entry ? (
                                <div
                                    style={{
                                        transform: `translate(${-shift * 100}%, -100%)`,
                                    }}
                                    className="rounded-dhis2-md border border-dhis2-border bg-dhis2-background px-1.5 py-0.5 text-[11px] leading-4 whitespace-nowrap shadow-dhis2-popover"
                                >
                                    <span className="font-medium text-dhis2-foreground tabular-nums">
                                        {entry.display}
                                    </span>
                                    <span className="text-dhis2-grey-700">
                                        {' · '}
                                        {entry.date}
                                    </span>
                                </div>
                            ) : null
                        }}
                    />
                    <YAxis hide domain={domain} />
                    {/* Straight segments: a smoothed curve invents values between visits. */}
                    <Line
                        dataKey="value"
                        type="linear"
                        stroke="var(--color-value)"
                        strokeWidth={2}
                        dot={({ key, index, cx, cy }) =>
                            index === lastIndex ? (
                                <circle
                                    key={key}
                                    cx={cx}
                                    cy={cy}
                                    r={3}
                                    className="recharts-dot"
                                    fill="var(--color-value)"
                                />
                            ) : null
                        }
                        isAnimationActive={false}
                    />
                </LineChart>
            </ChartContainer>
        </div>
    )
}
