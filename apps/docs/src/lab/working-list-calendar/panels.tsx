import { useWorkingListDateBounds } from '@/components/working-list'
import {
    useWorkingListCalendar,
    useWorkingListCalendarDay,
} from '@/components/working-list-calendar'
import type { ReactNode } from 'react'
import type { RequestLogEntry } from '../network'
import { RequestWaterfall } from '../RequestWaterfall'

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

/** The lab's bottom panel: callbacks, then (with lab data) each request and the waterfall they make. */
export const LogPanel = ({
    callbacks,
    requests,
    onClearCallbacks,
    onClearRequests,
}: {
    callbacks: string[]
    requests?: RequestLogEntry[]
    onClearCallbacks: () => void
    onClearRequests: () => void
}) => (
    <div className="grid h-full grid-cols-[1fr_1.4fr_2fr] divide-x divide-(--lab-rule)">
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

/** What the calendar holds right now, read through its public hook. */
export const CalendarReadout = () => {
    const calendar = useWorkingListCalendar()
    const { results } = calendar
    const bounds = useWorkingListDateBounds(calendar.dateField)
    const rows: Array<[string, string]> = [
        ['dateField', calendar.dateField],
        ['visibleMonth', String(calendar.visibleMonth)],
        ['selectedDay', calendar.selectedDay?.date ?? 'null'],
        ['display', calendar.display],
        ['results.status', results.status],
        [
            'records',
            results.status === 'ready' ? String(results.records.length) : '—',
        ],
        [
            'truncated',
            results.status === 'ready' ? String(results.truncated) : '—',
        ],
        ['filterBounds', `${bounds?.start ?? '…'} → ${bounds?.end ?? '…'}`],
        [
            'atFilterStart / End',
            `${calendar.atFilterStart} / ${calendar.atFilterEnd}`,
        ],
    ]
    return (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 rounded border border-dashed border-dhis2-grey-500 bg-dhis2-grey-050 p-2 font-mono text-xs">
            {rows.map(([name, value]) => (
                <div key={name} className="contents">
                    <dt className="text-dhis2-grey-700">{name}</dt>
                    <dd className="m-0">{value}</dd>
                </div>
            ))}
        </dl>
    )
}

/** A cell part of the lab's own: the day's record count, big, in the middle of the cell. */
export const PlainCount = () => {
    const { day } = useWorkingListCalendarDay()
    if (day.records.length === 0) return null
    return (
        <span className="flex flex-1 items-center justify-center text-[20px] leading-7 font-semibold text-dhis2-grey-900 tabular-nums">
            {day.records.length}
        </span>
    )
}
