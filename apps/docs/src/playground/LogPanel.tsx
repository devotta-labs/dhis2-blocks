import type { ReactNode } from 'react'
import type { RequestLogEntry } from './network'
import { RequestWaterfall } from './RequestWaterfall'

const tone = {
    pending: 'text-(--lab-caution)',
    ok: 'text-(--lab-ink-3)',
    failed: 'text-(--lab-fault)',
    aborted: 'text-(--lab-ink-4)',
}

const code = { pending: 'WAIT', ok: 'OK', failed: 'FAIL', aborted: 'ABRT' }

/** One column of the panel: its name set in ink, an optional clear, and a list that scrolls on its own. */
const Column = ({
    title,
    onClear,
    children,
}: {
    title: string
    onClear?: () => void
    children: ReactNode
}) => (
    <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex items-center gap-2 px-2 pt-1.5 pb-1">
            <span className="bg-(--lab-bar) px-1 text-[10.5px] tracking-[0.1em] text-(--lab-bar-ink)">
                {title}
            </span>
            {onClear && (
                <button
                    type="button"
                    className="ms-auto border-0 text-(--lab-ink-3)"
                    onClick={onClear}
                >
                    clr
                </button>
            )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 text-[11px]">
            {children}
        </div>
    </div>
)

const RequestLog = ({ entries }: { entries: RequestLogEntry[] }) => (
    <ol className="m-0 flex list-none flex-col p-0">
        {entries.map((entry) => {
            const params = Object.entries(entry.request.params ?? {})
                .filter(([name]) => name !== 'fields')
                .map(([name, value]) => `${name}=${String(value)}`)
                .join(' ')
            return (
                <li
                    key={entry.id}
                    className="border-b border-(--lab-rule-faint) py-0.5"
                    title={params}
                >
                    <span className="text-(--lab-ink-3)">{entry.at}</span>{' '}
                    <span className={tone[entry.outcome]}>
                        {code[entry.outcome]}
                        {entry.ms === undefined ? '' : ` ${entry.ms}`}
                    </span>{' '}
                    {entry.request.resource}
                    {entry.request.id ? `/${entry.request.id}` : ''}
                    {params && (
                        <div className="break-all text-(--lab-ink-3)">
                            {params}
                        </div>
                    )}
                    {entry.detail && (
                        <div className="text-(--lab-fault)">{entry.detail}</div>
                    )}
                </li>
            )
        })}
    </ol>
)

/**
 * A lab's bottom panel: the block's callbacks, when it has any, then (with lab data) each request and the waterfall
 * they make. On a phone the columns scroll sideways.
 */
export const LogPanel = ({
    callbacks,
    requests,
    onClearCallbacks,
    onClearRequests,
}: {
    callbacks?: string[]
    requests?: RequestLogEntry[]
    onClearCallbacks?: () => void
    onClearRequests: () => void
}) => {
    let columns = 'md:grid-cols-1'
    if (callbacks && requests) columns = 'md:grid-cols-[1fr_1.4fr_2fr]'
    else if (requests) columns = 'md:grid-cols-[1.4fr_2fr]'
    return (
        <div
            className={`grid h-full auto-cols-[minmax(16rem,85%)] grid-flow-col divide-x divide-(--lab-rule) overflow-x-auto md:auto-cols-auto md:grid-flow-row md:overflow-x-visible ${columns}`}
        >
            {callbacks && (
                <Column
                    title={`CALLBACKS ${callbacks.length}`}
                    onClear={onClearCallbacks}
                >
                    <ol className="m-0 flex list-none flex-col p-0">
                        {callbacks.map((entry, index) => (
                            <li
                                key={`${callbacks.length - index}`}
                                className="border-b border-(--lab-rule-faint) py-0.5 break-all"
                            >
                                {entry}
                            </li>
                        ))}
                    </ol>
                </Column>
            )}
            {requests && (
                <>
                    <Column
                        title={`REQUESTS ${requests.length}`}
                        onClear={onClearRequests}
                    >
                        <RequestLog entries={requests} />
                    </Column>
                    <Column title="WATERFALL">
                        <RequestWaterfall requests={requests} />
                    </Column>
                </>
            )}
        </div>
    )
}
