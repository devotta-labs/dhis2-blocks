import { Section } from './controls'
import type { RequestLogEntry } from './labServer'

export const RequestLog = ({
    entries,
    onClear,
}: {
    entries: RequestLogEntry[]
    onClear: () => void
}) => (
    <Section title={`Requests (${entries.length})`}>
        <button
            type="button"
            className="self-start text-xs text-dhis2-blue-700"
            onClick={onClear}
        >
            Clear
        </button>
        <ol className="m-0 flex max-h-80 list-none flex-col gap-1 overflow-y-auto p-0 font-mono text-[11px]">
            {entries.map((entry) => {
                const params = Object.entries(entry.request.params ?? {})
                    .filter(([name]) => name !== 'fields')
                    .map(([name, value]) => `${name}=${String(value)}`)
                    .join(' ')
                return (
                    <li
                        key={entry.id}
                        className="rounded bg-white p-1"
                        title={params}
                    >
                        <span
                            className={
                                entry.outcome === 'failed'
                                    ? 'text-dhis2-red-700'
                                    : 'text-dhis2-grey-700'
                            }
                        >
                            {entry.at} {entry.outcome}
                            {entry.ms === undefined ? '' : ` ${entry.ms}ms`}
                        </span>{' '}
                        <strong>
                            {entry.request.resource}
                            {entry.request.id ? `/${entry.request.id}` : ''}
                        </strong>
                        <div className="break-all text-dhis2-grey-700">
                            {params}
                        </div>
                        {entry.detail && (
                            <div className="text-dhis2-red-700">
                                {entry.detail}
                            </div>
                        )}
                    </li>
                )
            })}
        </ol>
    </Section>
)

export const CallbackLog = ({
    entries,
    onClear,
}: {
    entries: string[]
    onClear: () => void
}) => (
    <Section title={`Callbacks (${entries.length})`}>
        <button
            type="button"
            className="self-start text-xs text-dhis2-blue-700"
            onClick={onClear}
        >
            Clear
        </button>
        <ol className="m-0 flex max-h-48 list-none flex-col gap-0.5 overflow-y-auto p-0 font-mono text-[11px]">
            {entries.map((entry, index) => (
                <li key={`${entries.length - index}`} className="break-all">
                    {entry}
                </li>
            ))}
        </ol>
    </Section>
)
