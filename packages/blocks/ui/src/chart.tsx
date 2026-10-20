'use client'

import * as React from 'react'
import { cn } from './cn'
import * as RechartsPrimitive from 'recharts'
import type { TooltipValueType } from 'recharts'

/**
 * shadcn Chart (Recharts) restyled with the DHIS2 tokens. `ChartContainer`
 * exposes each config colour as a `--color-<key>` variable for the series.
 */

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: '', dark: '.dark' } as const

const INITIAL_DIMENSION = { width: 320, height: 200 } as const
type TooltipNameType = number | string

export type ChartConfig = Record<
    string,
    {
        label?: React.ReactNode
        icon?: React.ComponentType
    } & (
        | { color?: string; theme?: never }
        | { color?: never; theme: Record<keyof typeof THEMES, string> }
    )
>

type ChartContextProps = {
    config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
    const context = React.useContext(ChartContext)

    if (!context) {
        throw new Error('useChart must be used within a <ChartContainer />')
    }

    return context
}

function ChartContainer({
    id,
    className,
    children,
    config,
    initialDimension = INITIAL_DIMENSION,
    ...props
}: React.ComponentProps<'div'> & {
    config: ChartConfig
    children: React.ComponentProps<
        typeof RechartsPrimitive.ResponsiveContainer
    >['children']
    initialDimension?: {
        width: number
        height: number
    }
}) {
    const uniqueId = React.useId()
    const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`

    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-slot="chart"
                data-chart={chartId}
                className={cn(
                    "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-dhis2-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-dhis2-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-dhis2-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-dhis2-border [&_.recharts-radial-bar-background-sector]:fill-dhis2-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-dhis2-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-dhis2-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
                    className
                )}
                {...props}
            >
                <ChartStyle id={chartId} config={config} />
                <RechartsPrimitive.ResponsiveContainer
                    initialDimension={initialDimension}
                >
                    {children}
                </RechartsPrimitive.ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
    const colorConfig = Object.entries(config).filter(
        ([, config]) => config.theme ?? config.color
    )

    if (!colorConfig.length) {
        return null
    }

    return (
        <style
            dangerouslySetInnerHTML={{
                __html: Object.entries(THEMES)
                    .map(
                        ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
    .map(([key, itemConfig]) => {
        // SAFETY: `theme` comes from Object.entries(THEMES), whose keys are exactly those of `itemConfig.theme`.
        const themeColor =
            itemConfig.theme?.[theme as keyof typeof itemConfig.theme]
        const color = themeColor ?? itemConfig.color
        return color ? `  --color-${key}: ${color};` : null
    })
    .join('\n')}
}
`
                    )
                    .join('\n'),
            }}
        />
    )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
    active,
    payload,
    className,
    indicator = 'dot',
    hideLabel = false,
    hideIndicator = false,
    label,
    labelFormatter,
    labelClassName,
    formatter,
    color,
    nameKey,
    labelKey,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<'div'> & {
        hideLabel?: boolean
        hideIndicator?: boolean
        indicator?: 'line' | 'dot' | 'dashed'
        nameKey?: string
        labelKey?: string
    } & Omit<
        RechartsPrimitive.DefaultTooltipContentProps<
            TooltipValueType,
            TooltipNameType
        >,
        'accessibilityLayer'
    >) {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
        if (hideLabel || !payload?.length) {
            return null
        }

        const [item] = payload
        const key = `${labelKey ?? item?.dataKey ?? item?.name ?? 'value'}`
        const itemConfig = getPayloadConfigFromPayload(config, item, key)
        const value =
            !labelKey && isString(label)
                ? (config[label]?.label ?? label)
                : itemConfig?.label

        if (labelFormatter) {
            return (
                <div className={cn('font-medium', labelClassName)}>
                    {labelFormatter(value, payload)}
                </div>
            )
        }

        if (!value) {
            return null
        }

        return <div className={cn('font-medium', labelClassName)}>{value}</div>
    }, [
        label,
        labelFormatter,
        payload,
        hideLabel,
        labelClassName,
        config,
        labelKey,
    ])

    if (!active || !payload?.length) {
        return null
    }

    const nestLabel = payload.length === 1 && indicator !== 'dot'

    return (
        <div
            className={cn(
                'grid min-w-32 items-start gap-1.5 rounded-dhis2-lg border border-dhis2-border bg-dhis2-background px-2.5 py-1.5 text-xs shadow-dhis2-popover',
                className
            )}
        >
            {!nestLabel ? tooltipLabel : null}
            <div className="grid gap-1.5">
                {payload
                    .filter((item) => item.type !== 'none')
                    .map((item, index) => {
                        const key = `${nameKey ?? item.name ?? item.dataKey ?? 'value'}`
                        const itemConfig = getPayloadConfigFromPayload(
                            config,
                            item,
                            key
                        )
                        const indicatorColor =
                            color ?? item.payload?.fill ?? item.color
                        // SAFETY: React's CSSProperties has no index signature for custom properties; the browser accepts them.
                        const indicatorStyle = {
                            '--indicator-bg': indicatorColor,
                            '--indicator-border': indicatorColor,
                        } as React.CSSProperties

                        return (
                            <div
                                key={index}
                                className={cn(
                                    'flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-dhis2-muted-foreground',
                                    indicator === 'dot' && 'items-center'
                                )}
                            >
                                {formatter &&
                                item?.value !== undefined &&
                                item.name ? (
                                    formatter(
                                        item.value,
                                        item.name,
                                        item,
                                        index,
                                        item.payload
                                    )
                                ) : (
                                    <>
                                        {itemConfig?.icon ? (
                                            <itemConfig.icon />
                                        ) : (
                                            !hideIndicator && (
                                                <div
                                                    className={cn(
                                                        'shrink-0 rounded-[2px] border-(--indicator-border) bg-(--indicator-bg)',
                                                        {
                                                            'h-2.5 w-2.5':
                                                                indicator ===
                                                                'dot',
                                                            'w-1':
                                                                indicator ===
                                                                'line',
                                                            'w-0 border-[1.5px] border-dashed bg-transparent':
                                                                indicator ===
                                                                'dashed',
                                                            'my-0.5':
                                                                nestLabel &&
                                                                indicator ===
                                                                    'dashed',
                                                        }
                                                    )}
                                                    style={indicatorStyle}
                                                />
                                            )
                                        )}
                                        <div
                                            className={cn(
                                                'flex flex-1 justify-between leading-none',
                                                nestLabel
                                                    ? 'items-end'
                                                    : 'items-center'
                                            )}
                                        >
                                            <div className="grid gap-1.5">
                                                {nestLabel
                                                    ? tooltipLabel
                                                    : null}
                                                <span className="text-dhis2-muted-foreground">
                                                    {itemConfig?.label ??
                                                        item.name}
                                                </span>
                                            </div>
                                            {item.value != null && (
                                                <span className="font-mono font-medium text-dhis2-foreground tabular-nums">
                                                    {isNumber(item.value)
                                                        ? item.value.toLocaleString()
                                                        : String(item.value)}
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    })}
            </div>
        </div>
    )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
    className,
    hideIcon = false,
    payload,
    verticalAlign = 'bottom',
    nameKey,
}: React.ComponentProps<'div'> & {
    hideIcon?: boolean
    nameKey?: string
} & RechartsPrimitive.DefaultLegendContentProps) {
    const { config } = useChart()

    if (!payload?.length) {
        return null
    }

    return (
        <div
            className={cn(
                'flex items-center justify-center gap-4',
                verticalAlign === 'top' ? 'pb-3' : 'pt-3',
                className
            )}
        >
            {payload
                .filter((item) => item.type !== 'none')
                .map((item, index) => {
                    const key = `${nameKey ?? item.dataKey ?? 'value'}`
                    const itemConfig = getPayloadConfigFromPayload(
                        config,
                        item,
                        key
                    )

                    return (
                        <div
                            key={index}
                            className={cn(
                                'flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-dhis2-muted-foreground'
                            )}
                        >
                            {itemConfig?.icon && !hideIcon ? (
                                <itemConfig.icon />
                            ) : (
                                <div
                                    className="h-2 w-2 shrink-0 rounded-[2px]"
                                    style={{
                                        backgroundColor: item.color,
                                    }}
                                />
                            )}
                            {itemConfig?.label}
                        </div>
                    )
                })}
        </div>
    )
}

/** A primitive string. `String(value) === value` holds for no other kind of value. */
const isString = <Value,>(value: Value): value is Value & string =>
    String(value) === value

/** A primitive number, NaN included. */
const isNumber = <Value,>(value: Value): value is Value & number =>
    Object.is(Number(value), value)

/** A non-null object: `Object(value)` is the value itself only for objects. */
const isObject = <Value,>(value: Value): value is Value & object =>
    Object(value) === value

/** A Recharts tooltip or legend item, which may nest the data row it came from. */
type PayloadItem = { readonly payload?: object }

/** The value of an own field of a payload item or row, if it has one. */
const fieldOf = (item: PayloadItem | undefined, field: string) =>
    Object.entries(item ?? {}).find(([name]) => name === field)?.[1]

/** The config for a Recharts payload item, found by `key` on the item or its nested payload. */
function getPayloadConfigFromPayload(
    config: ChartConfig,
    payload: PayloadItem | undefined,
    key: string
) {
    if (payload === undefined) {
        return undefined
    }

    const nested = fieldOf(payload, 'payload')
    const payloadPayload = isObject(nested) ? nested : undefined

    let configLabelKey: string = key

    const ownLabelKey = fieldOf(payload, key)
    const nestedLabelKey = fieldOf(payloadPayload, key)
    if (isString(ownLabelKey)) {
        configLabelKey = ownLabelKey
    } else if (isString(nestedLabelKey)) {
        configLabelKey = nestedLabelKey
    }

    return configLabelKey in config ? config[configLabelKey] : config[key]
}

export {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
    ChartStyle,
}
