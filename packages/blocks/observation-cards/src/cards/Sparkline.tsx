import React from 'react'
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/registry/dhis2/ui/chart'
import { cn } from '@/registry/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import { Line, LineChart, YAxis } from 'recharts'
import type { ObservationSeries } from '../use-tracked-entity-observations'
import { useFormatDate } from './calendar'
import { displayValue } from './format'

const DEFAULT_MAX_POINTS = 12

export interface SparklineProps {
    series: ObservationSeries
    /** Shown after the value in the tooltip, such as `kg`. */
    unit?: string
    /** The most recent readings to plot. */
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

    const plotted = series.points
        .filter((point) => point.numericValue !== undefined)
        .slice(-maxPoints)
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
        <div className={cn('h-10 w-full', className)}>
            <span className="sr-only">{summary}</span>
            <ChartContainer
                aria-hidden="true"
                config={config}
                className="aspect-auto h-full w-full"
            >
                <LineChart
                    data={data}
                    margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                    accessibilityLayer={false}
                >
                    <ChartTooltip
                        content={
                            <ChartTooltipContent
                                hideIndicator
                                labelFormatter={(_label, items) =>
                                    items[0]?.payload?.date
                                }
                                formatter={(_value, _name, item) => (
                                    <span className="font-mono font-medium text-dhis2-foreground tabular-nums">
                                        {item.payload?.display}
                                    </span>
                                )}
                            />
                        }
                    />
                    {/* Fit the readings, not zero up: a weight of 79 to 77 kg would otherwise look flat. */}
                    <YAxis
                        hide
                        domain={([min, max]: readonly number[]) =>
                            min === max ? [min - 1, max + 1] : [min, max]
                        }
                    />
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
