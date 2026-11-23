import {
    ChartContainer,
    ChartTooltip,
    type ChartConfig,
} from '@/components/dhis2/ui/chart'
import { cn } from '@/components/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import React, { useLayoutEffect, useState } from 'react'
import { Line, LineChart, YAxis } from 'recharts'
import { useObservationCard } from '../card/context'
import {
    formatPointValue,
    formatRecordedDate,
    isStale,
    NO_ESCAPE,
    showsTrend,
} from '../format/display'

const DEFAULT_POINTS = 12
const DEFAULT_CHART_HEIGHT = 40
const MARGIN = 4
const TOOLTIP_GAP = 6

export interface ObservationSparklineProps {
    /** The most recent readings to plot; 0 plots nothing. */
    points?: number
    /** Applies to the chart's box, so it can resize the chart. */
    className?: string
}

/**
 * A compact line of the latest numeric readings, with a text summary for
 * screen readers. A card narrower than 13rem drops it. Option codes are
 * categories, so it plots none, even numeric ones.
 */
export function ObservationSparkline({
    points = DEFAULT_POINTS,
    className,
}: ObservationSparklineProps) {
    const { series, unit, staleAfterDays, display } = useObservationCard()
    const [anchor, setAnchor] = useState<{
        index: number
        x: number
        y: number
    }>()
    const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)
    const [shown, setShown] = useState(false)
    useLayoutEffect(() => {
        if (!wrapper) {
            return undefined
        }
        setShown(wrapper.getBoundingClientRect().width > 0)
        const observer = new ResizeObserver(([entry]) =>
            setShown((entry?.contentRect.width ?? 0) > 0)
        )
        observer.observe(wrapper)
        return () => observer.disconnect()
    }, [wrapper])

    const numeric = series.points.filter(
        (point) => point.numericValue !== undefined
    )
    const plotted = numeric.slice(
        Math.max(0, numeric.length - Math.floor(points))
    )
    const first = plotted.at(0)
    const last = plotted.at(-1)
    if (
        !showsTrend(series) ||
        numeric.length < 2 ||
        first === undefined ||
        last === undefined
    ) {
        return null
    }

    const config: ChartConfig = {
        value: {
            label: series.label,
            color:
                series.latest &&
                isStale(series.latest, staleAfterDays, new Date())
                    ? 'var(--dhis2-neutral-indicator)'
                    : 'var(--dhis2-primary)',
        },
    }
    const data = plotted.map((point) => ({
        value: point.numericValue,
        date: formatRecordedDate(point, display),
        display: [formatPointValue(series, point, display), unit]
            .filter(Boolean)
            .join(' '),
    }))
    const lastIndex = data.length - 1

    const values = data.map((entry) => entry.value ?? 0)
    const low = Math.min(...values)
    const high = Math.max(...values)
    const domain: [number, number] =
        low === high ? [low - 1, high + 1] : [low, high]
    const yFor = (value: number, height: number) =>
        MARGIN +
        ((domain[1] - value) / (domain[1] - domain[0])) * (height - 2 * MARGIN)

    const latest = formatPointValue(series, last, display)
    const summary =
        plotted.length === 1
            ? i18n.t('1 reading on {{date}}, latest {{latest}}', {
                  date: formatRecordedDate(first, display),
                  latest,
                  interpolation: NO_ESCAPE,
              })
            : i18n.t(
                  '{{count}} readings from {{from}} to {{to}}, latest {{latest}}',
                  {
                      count: plotted.length,
                      from: formatRecordedDate(first, display),
                      to: formatRecordedDate(last, display),
                      latest,
                      interpolation: NO_ESCAPE,
                  }
              )

    return (
        <div
            data-slot="observation-sparkline"
            className="@container w-full [&:has(+[data-slot=observation-recorded])]:mt-auto"
        >
            <span className="sr-only">{summary}</span>
            <div
                ref={setWrapper}
                className={cn('hidden h-10 w-full @[13rem]:block', className)}
            >
                {shown ? (
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
                                                      wrapper?.clientHeight ||
                                                          DEFAULT_CHART_HEIGHT
                                                  ) - TOOLTIP_GAP,
                                          }
                                )
                            }}
                            onMouseLeave={() => setAnchor(undefined)}
                        >
                            <ChartTooltip
                                position={anchor}
                                allowEscapeViewBox={{ x: true, y: true }}
                                isAnimationActive={false}
                                content={({ active }) => {
                                    const entry = anchor && data[anchor.index]
                                    const width = wrapper?.clientWidth
                                    const shift =
                                        anchor && width
                                            ? Math.min(
                                                  Math.max(anchor.x / width, 0),
                                                  1
                                              )
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
                                            <span className="text-dhis2-muted-foreground">
                                                {' · '}
                                                {entry.date}
                                            </span>
                                        </div>
                                    ) : null
                                }}
                            />
                            <YAxis hide domain={domain} />
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
                ) : null}
            </div>
        </div>
    )
}
