import { Badge } from '@/registry/dhis2/ui/badge'
import React, { type CSSProperties } from 'react'
import type {
    ObservationLegend,
    ObservationOption,
} from '../use-tracked-entity-observations'
import { normaliseColor, readableTextColor } from './format'

export interface LegendBadgeProps {
    legend: ObservationLegend | undefined
    option: ObservationOption | undefined
}

/** A pill with the legend or option name, coloured from its metadata. Nothing when there is neither. */
export function LegendBadge({ legend, option }: LegendBadgeProps) {
    const source = legend ?? option
    if (source === undefined) {
        return null
    }

    const color = normaliseColor(source.color)
    if (color === undefined) {
        return <Badge variant="outline">{source.name}</Badge>
    }

    const style: CSSProperties = {
        backgroundColor: color,
        color: readableTextColor(color),
    }
    return <Badge style={style}>{source.name}</Badge>
}
