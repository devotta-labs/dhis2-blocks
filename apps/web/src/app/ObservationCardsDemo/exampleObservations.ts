import type {
    ObservationLegend,
    ObservationOption,
    ObservationPoint,
    ObservationResult,
    ObservationSeries,
} from '@dhis2-blocks/observation-cards'

/**
 * Hand-written observations for the "All demo examples" tab. The cards never
 * fetch, so they render these exactly as they would hook output. The
 * metadata is idealised: real instances rarely define legend sets or option
 * colours this completely.
 */

const DAY = 24 * 60 * 60 * 1000
const STAGE = { id: 'exStage', name: 'Antenatal care visit' }

const daysAgo = (days: number) =>
    new Date(Date.now() - days * DAY).toISOString().slice(0, 19)

const point = (value: string, days: number, index: number) => {
    const numericValue = Number(value)
    const result: ObservationPoint = {
        value,
        occurredAt: daysAgo(days),
        source: {
            eventId: `ex${index}`,
            programStageId: STAGE.id,
            programStageName: STAGE.name,
        },
    }
    if (!Number.isNaN(numericValue)) {
        result.numericValue = numericValue
    }
    return result
}

const series = (
    id: string,
    label: string,
    valueType: string,
    readings: Array<[value: string, daysAgo: number]>,
    extra: Partial<ObservationSeries> = {}
): ObservationResult => {
    const points = readings
        .map(([value, days], index) => point(value, days, index))
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    const latest = points.at(-1)
    const previous = points.at(-2)
    const change =
        latest?.numericValue !== undefined &&
        previous?.numericValue !== undefined
            ? latest.numericValue - previous.numericValue
            : undefined
    return {
        status: 'success',
        series: {
            dataElementId: id,
            label,
            valueType,
            points,
            latest,
            previous,
            change,
            partial: false,
            ...extra,
        },
    }
}

const HAEMOGLOBIN_LEGENDS: ObservationLegend[] = [
    { name: 'Severe anaemia', color: '#d32f2f', startValue: 0, endValue: 7 },
    { name: 'Moderate anaemia', color: '#ef6c00', startValue: 7, endValue: 10 },
    { name: 'Mild anaemia', color: '#f9a825', startValue: 10, endValue: 11 },
    { name: 'Normal', color: '#2e7d32', startValue: 11, endValue: 20 },
]

/** Puts every reading of an example in another program stage. */
const inStage = (
    result: ObservationResult,
    programStageName: string
): ObservationResult =>
    result.status === 'success'
        ? {
              ...result,
              series: {
                  ...result.series,
                  points: result.series.points.map((reading) => ({
                      ...reading,
                      source: { ...reading.source, programStageName },
                  })),
                  latest: result.series.latest && {
                      ...result.series.latest,
                      source: {
                          ...result.series.latest.source,
                          programStageName,
                      },
                  },
              },
          }
        : result

const HAEMOGLOBIN_LEGENDS_AR: ObservationLegend[] = [
    { name: 'فقر دم شديد', color: '#d32f2f', startValue: 0, endValue: 7 },
    { name: 'فقر دم متوسط', color: '#ef6c00', startValue: 7, endValue: 10 },
    { name: 'فقر دم خفيف', color: '#f9a825', startValue: 10, endValue: 11 },
    { name: 'طبيعي', color: '#2e7d32', startValue: 11, endValue: 20 },
]

const RISK_OPTIONS: ObservationOption[] = [
    { code: 'LOW', name: 'Low risk', color: '#2e7d32' },
    { code: 'MODERATE', name: 'Moderate risk', color: '#f9a825' },
    { code: 'HIGH', name: 'High risk', color: '#d32f2f' },
]

export interface ExampleCard {
    /** What this card demonstrates, shown above it. */
    caption: string
    kind: 'trend' | 'latest'
    observation: ObservationResult
    unit?: string
    label?: string
    staleAfterDays?: number
    /** Renders the card right to left, as a host in that language would. */
    dir?: 'rtl'
    lang?: string
}

export const EXAMPLE_CARDS: ExampleCard[] = [
    {
        caption: 'Numeric trend with a legend set',
        kind: 'trend',
        unit: 'g/dL',
        observation: series(
            'exHb',
            'Haemoglobin',
            'NUMBER',
            [
                ['9.1', 120],
                ['10.2', 90],
                ['10.8', 60],
                ['11.6', 30],
                ['12.3', 4],
            ],
            { legends: HAEMOGLOBIN_LEGENDS }
        ),
    },
    {
        caption: 'Falling trend, no legend set',
        kind: 'trend',
        unit: 'kg',
        observation: series('exWeight', 'Weight', 'NUMBER', [
            ['82', 150],
            ['80.5', 100],
            ['79', 50],
            ['77.4', 6],
        ]),
    },
    {
        caption: 'A single reading',
        kind: 'trend',
        unit: 'mmHg',
        observation: series('exBp', 'Systolic blood pressure', 'INTEGER', [
            ['118', 3],
        ]),
    },
    {
        caption: 'Option set with option colours',
        kind: 'latest',
        observation: series(
            'exRisk',
            'Pregnancy risk assessment',
            'TEXT',
            [
                ['LOW', 60],
                ['MODERATE', 5],
            ],
            { options: RISK_OPTIONS }
        ),
    },
    {
        caption: 'Yes/No value',
        kind: 'latest',
        observation: series('exSmoking', 'Smoking', 'BOOLEAN', [
            ['true', 70],
            ['false', 6],
        ]),
    },
    {
        caption: 'Tick-only field left unticked at the latest visit',
        kind: 'latest',
        observation: series('exPallor', 'Extreme pallor', 'TRUE_ONLY', [
            ['true', 70],
            ['false', 6],
        ]),
    },
    {
        caption: 'Free text',
        kind: 'latest',
        observation: series('exNote', 'Clinical note', 'LONG_TEXT', [
            ['Reports mild headaches in the evening; advised to rest.', 6],
        ]),
    },
    {
        caption: 'Out of date (older than 180 days)',
        kind: 'latest',
        unit: 'mmHg',
        staleAfterDays: 180,
        observation: series('exBpOld', 'Diastolic blood pressure', 'INTEGER', [
            ['76', 400],
            ['78', 260],
        ]),
    },
    {
        caption: 'Some visits hidden by the user’s access',
        kind: 'latest',
        unit: 'g/dL',
        observation: series(
            'exPartial',
            'Haemoglobin (restricted stage)',
            'NUMBER',
            [['11.9', 12]],
            { partial: true }
        ),
    },
    {
        caption: 'Long data element name',
        kind: 'trend',
        unit: 'g/dL',
        observation: series(
            'exLong',
            'MCH Haemoglobin value at first antenatal care visit (point-of-care HemoCue reading)',
            'NUMBER',
            [
                ['10.4', 80],
                ['10.9', 40],
                ['11.3', 8],
            ],
            { legends: HAEMOGLOBIN_LEGENDS }
        ),
    },
    {
        caption: 'Right to left (Arabic)',
        kind: 'trend',
        unit: 'غ/دل',
        dir: 'rtl',
        lang: 'ar',
        observation: inStage(
            series(
                'exRtl',
                'الهيموغلوبين',
                'NUMBER',
                [
                    ['9.4', 120],
                    ['10.1', 80],
                    ['10.6', 40],
                    ['11.2', 5],
                ],
                { legends: HAEMOGLOBIN_LEGENDS_AR }
            ),
            'زيارة رعاية ما قبل الولادة'
        ),
    },
    {
        caption: 'Never recorded',
        kind: 'latest',
        observation: series('exNever', 'Fundal height', 'NUMBER', []),
    },
    {
        caption: 'Loading (last recorded)',
        kind: 'latest',
        label: 'Loading example',
        observation: { status: 'pending' },
    },
    {
        caption: 'Loading (trend)',
        kind: 'trend',
        label: 'Loading example',
        observation: { status: 'pending' },
    },
    {
        caption: 'Failed to load',
        kind: 'latest',
        label: 'Error example',
        observation: { status: 'error', error: new Error('Example failure') },
    },
]
