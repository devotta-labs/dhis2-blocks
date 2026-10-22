import type {
    DataElementMetadata,
    ObservationLegend,
    ObservationOption,
    ObservationPoint,
    ObservationSeries,
    StageMetadata,
    TrackerEventRecord,
} from './types'

const NUMERIC_VALUE_TYPES = new Set([
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'PERCENTAGE',
    'UNIT_INTERVAL',
])

/** Value types whose readings carry a `numericValue`. */
export const isNumericValueType = (valueType: string): boolean =>
    NUMERIC_VALUE_TYPES.has(valueType)

const ELIGIBLE_STATUSES = new Set(['ACTIVE', 'COMPLETED'])

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const HAS_ZONE = /(Z|[+-]\d{2}(:?\d{2})?)$/i

/**
 * Parses an ISO date or date-time to epoch milliseconds. Date-only and unzoned
 * strings are read as UTC so they order consistently with zoned strings.
 * Returns NaN when the string is not a date.
 */
export const toInstant = (iso: string): number => {
    if (DATE_ONLY.test(iso)) {
        return Date.parse(`${iso}T00:00:00Z`)
    }
    const [, time = ''] = iso.split('T')
    return Date.parse(HAS_ZONE.test(time) ? iso : `${iso}Z`)
}

const parseNumber = (value: string): number | undefined => {
    if (value.trim() === '') {
        return undefined
    }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

interface DatedPoint {
    point: ObservationPoint
    occurredInstant: number
    createdInstant: number
}

const compareDated = (a: DatedPoint, b: DatedPoint): number => {
    if (a.occurredInstant !== b.occurredInstant) {
        return a.occurredInstant - b.occurredInstant
    }
    if (a.createdInstant !== b.createdInstant) {
        return a.createdInstant - b.createdInstant
    }
    const idA = a.point.source.eventId
    const idB = b.point.source.eventId
    if (idA === idB) {
        return 0
    }
    return idA < idB ? -1 : 1
}

const buildLegends = (
    dataElement: DataElementMetadata
): ObservationLegend[] | undefined => {
    const legends = dataElement.legendSets?.[0]?.legends
    if (!legends || legends.length === 0) {
        return undefined
    }
    return [...legends].sort((a, b) => a.startValue - b.startValue)
}

const buildOptions = (
    dataElement: DataElementMetadata
): ObservationOption[] | undefined =>
    dataElement.optionSet?.options.map(({ code, name, style }) =>
        style?.color ? { code, name, color: style.color } : { code, name }
    )

export function buildSeries({
    dataElement,
    stages,
    events,
}: {
    dataElement: DataElementMetadata
    stages: StageMetadata[]
    events: TrackerEventRecord[]
}): ObservationSeries {
    const isNumeric = isNumericValueType(dataElement.valueType)
    const isTrueOnly = dataElement.valueType === 'TRUE_ONLY'
    const stageById = new Map(stages.map((stage) => [stage.id, stage]))
    const capturingStageIds = new Set(
        stages
            .filter((stage) => stage.dataElementIds.includes(dataElement.id))
            .map((stage) => stage.id)
    )

    const dated: DatedPoint[] = []
    for (const event of events) {
        const { occurredAt } = event
        if (!ELIGIBLE_STATUSES.has(event.status) || !occurredAt) {
            continue
        }
        const occurredInstant = toInstant(occurredAt)
        if (Number.isNaN(occurredInstant)) {
            continue
        }

        const rawValue = event.dataValues.find(
            (dv) => dv.dataElement === dataElement.id
        )?.value

        let value: string
        if (isTrueOnly) {
            if (!capturingStageIds.has(event.programStage)) {
                continue
            }
            value = rawValue === 'true' ? 'true' : 'false'
        } else {
            if (rawValue === undefined || rawValue.trim() === '') {
                continue
            }
            value = rawValue
        }

        const point: ObservationPoint = {
            value,
            occurredAt,
            source: {
                eventId: event.event,
                programStageId: event.programStage,
                programStageName:
                    stageById.get(event.programStage)?.displayName ??
                    event.programStage,
            },
        }
        if (isNumeric) {
            const numericValue = parseNumber(value)
            if (numericValue === undefined) {
                continue
            }
            point.numericValue = numericValue
        }

        const createdInstant = event.createdAt
            ? toInstant(event.createdAt)
            : Number.NaN
        dated.push({
            point,
            occurredInstant,
            createdInstant: Number.isNaN(createdInstant) ? 0 : createdInstant,
        })
    }

    const points = dated.sort(compareDated).map(({ point }) => point)
    const latest = points.at(-1)
    const previous = points.at(-2)
    const change =
        latest?.numericValue !== undefined &&
        previous?.numericValue !== undefined
            ? latest.numericValue - previous.numericValue
            : undefined

    return {
        dataElementId: dataElement.id,
        label: dataElement.displayFormName || dataElement.displayName,
        valueType: dataElement.valueType,
        points,
        latest,
        previous,
        change,
        legends: buildLegends(dataElement),
        options: buildOptions(dataElement),
        partial: stages.some(
            (stage) =>
                !stage.canReadData &&
                stage.dataElementIds.includes(dataElement.id)
        ),
    }
}
