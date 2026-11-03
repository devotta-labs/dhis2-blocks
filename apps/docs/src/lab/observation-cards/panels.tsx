import { useObservation } from '@/components/observation-cards'

const rowsOf = (state: ReturnType<typeof useObservation>) => {
    switch (state.status) {
        case 'pending':
            return []
        case 'error':
            return [['error', state.error.message]]
        case 'misconfigured':
            return [['message', state.message]]
        default: {
            const { series } = state
            const point = (each: typeof series.latest) =>
                each ? `${each.value} · ${each.occurredAt}` : '—'
            return [
                ['label', series.label],
                ['valueType', series.valueType],
                ['points', String(series.points.length)],
                ['latest', point(series.latest)],
                ['previous', point(series.previous)],
                ['change', String(series.change ?? '—')],
                [
                    'legends',
                    series.legends
                        ?.map(
                            (band) =>
                                `${band.name} [${band.startValue}, ${band.endValue})`
                        )
                        .join(', ') ?? '—',
                ],
                [
                    'options',
                    series.options
                        ?.map(
                            (option) =>
                                `${option.code}=${option.name}${option.color ? ` ${option.color}` : ''}`
                        )
                        .join(', ') ?? '—',
                ],
                ['partial', String(series.partial)],
            ]
        }
    }
}

/** What `useObservation` returns for a card, beside the cards. */
export const SeriesReadout = ({ dataElement }: { dataElement: string }) => {
    const state = useObservation(dataElement)
    return (
        <dl
            aria-label="useObservation"
            className="m-0 grid w-80 shrink-0 grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 rounded border border-dashed border-dhis2-grey-500 bg-dhis2-grey-050 p-2 font-mono text-xs break-all"
        >
            <dt className="text-dhis2-grey-700">status</dt>
            <dd className="m-0">{state.status}</dd>
            {rowsOf(state).map(([name, value]) => (
                <div key={name} className="contents">
                    <dt className="text-dhis2-grey-700">{name}</dt>
                    <dd className="m-0">{value}</dd>
                </div>
            ))}
        </dl>
    )
}
