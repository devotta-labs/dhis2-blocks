import { useEffect, useState } from 'react'
import type { NetworkRequest, RequestLogEntry } from './network'

const labelOf = ({ resource, id }: NetworkRequest) =>
    id ? `${resource}/${id}` : resource

/** Each request's bar, in percent of the time from the first request starting to the last one settling (or `now`). */
export const placeBars = (requests: RequestLogEntry[], now: number) => {
    const took = (request: RequestLogEntry) =>
        request.ms ?? Math.max(now - request.started, 0)
    const start = Math.min(...requests.map(({ started }) => started))
    const end = Math.max(
        ...requests.map((request) => request.started + took(request))
    )
    const span = Math.max(end - start, 1)
    return {
        span: Math.round(span),
        bars: requests.map((request) => ({
            request,
            left: ((request.started - start) / span) * 100,
            width: (took(request) / span) * 100,
        })),
    }
}

const tone = {
    pending: 'text-(--lab-caution)',
    ok: 'text-(--lab-ink)',
    failed: 'text-(--lab-fault)',
    aborted: 'text-(--lab-ink-4)',
}

const tag = { pending: 'WAIT', ok: '', failed: 'FAIL', aborted: 'ABRT' }

// A tenth of the span between each scale line.
const scale =
    'bg-[repeating-linear-gradient(to_right,var(--lab-rule-faint)_0_1px,transparent_1px_10%)]'
const grid = 'grid grid-cols-[minmax(0,10rem)_4.5rem_1fr] items-center gap-2'

/** Every request on one time line, oldest first, so a slow request that holds up the others shows. */
export const RequestWaterfall = ({
    requests,
}: {
    requests: RequestLogEntry[]
}) => {
    const [now, setNow] = useState(() => performance.now())
    const pending = requests.some(({ outcome }) => outcome === 'pending')

    useEffect(() => {
        if (!pending) return
        const timer = setInterval(() => setNow(performance.now()), 100)
        return () => clearInterval(timer)
    }, [pending])

    if (requests.length === 0) {
        return <p className="m-0 text-(--lab-ink-3)">NO REQUESTS</p>
    }

    const { span, bars } = placeBars(
        [...requests].sort((a, b) => a.started - b.started),
        now
    )

    return (
        <div className="flex flex-col gap-0.5 text-[11px]">
            <div className={`${grid} text-(--lab-ink-3)`}>
                <span>{requests.length} REQ</span>
                <span className="text-end">MS</span>
                <span className="relative flex h-4 justify-between border-b border-(--lab-rule) bg-[repeating-linear-gradient(to_right,var(--lab-rule)_0_1px,transparent_1px_10%)] bg-size-[100%_4px] bg-bottom bg-no-repeat">
                    <span>0</span>
                    <span>{Math.round(span / 2)}</span>
                    <span>{span}</span>
                </span>
            </div>
            <ol className="m-0 flex list-none flex-col p-0">
                {bars.map(({ request, left, width }) => (
                    <li
                        key={request.id}
                        className={`${grid} h-4 hover:bg-(--lab-rule-faint)`}
                        title={[labelOf(request.request), request.detail]
                            .filter(Boolean)
                            .join('\n')}
                    >
                        <span className="truncate">
                            {labelOf(request.request)}
                        </span>
                        <span className={`text-end ${tone[request.outcome]}`}>
                            {tag[request.outcome]}{' '}
                            {request.ms ??
                                Math.max(0, Math.round(now - request.started))}
                        </span>
                        <span className={`relative h-full ${scale}`}>
                            <span
                                aria-hidden="true"
                                className={`absolute inset-y-1 min-w-0.5 bg-[repeating-linear-gradient(to_right,currentColor_0_3px,transparent_3px_4px)] ${tone[request.outcome]}`}
                                style={{ left: `${left}%`, width: `${width}%` }}
                            >
                                {request.outcome === 'pending' && (
                                    <span className="lab-blink absolute inset-y-0 -end-1 w-1 bg-current" />
                                )}
                            </span>
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    )
}
