import i18n from '@dhis2/d2-i18n'
import { useMemo } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { cellDomId } from '../cells/cellProps'
import { formatCount } from '../cells/OptionCell'
import type { SummaryItem } from '../logic/summary'
import { cellKey } from '../model/types'
import { useDataEntryContext } from '../provider/context'
import { useDataEntry } from '../provider/hooks'

// Labels and messages are shown as DHIS2 and the rules give them, not HTML-escaped.
const AS_IS = { escapeValue: false }

const TONES = {
    error: 'border-dhis2-red-600',
    errorOnComplete: 'border-dhis2-red-600',
    failed: 'border-dhis2-red-600',
    warning: 'border-dhis2-yellow-700',
    warningOnComplete: 'border-dhis2-yellow-700',
    unsent: 'border-dhis2-grey-500',
} satisfies Record<SummaryItem['kind'], string>

const Item = ({
    item: { key, kind, text },
    rows,
    fields,
}: {
    item: SummaryItem
    rows: ReadonlyMap<string, string>
    fields: ReadonlyMap<string, string>
}) => {
    const dot = key.indexOf('.')
    const rowId = dot < 0 ? key : key.slice(0, dot)
    const row = rows.get(rowId) ?? rowId
    const className = cn('border-s-2 ps-2', TONES[kind])
    // A message without a field is the row's: there is no cell to go to.
    if (dot < 0) {
        return (
            <li className={className}>
                {i18n.t('{{row}}: {{message}}', {
                    row,
                    message: text,
                    interpolation: AS_IS,
                })}
            </li>
        )
    }
    const column = key.slice(dot + 1)
    const target = cellDomId(cellKey(rowId, column))
    return (
        <li className={className}>
            <a
                href={`#${target}`}
                onClick={(event) => {
                    // Focus moves without touching the address, which some apps route by.
                    event.preventDefault()
                    document.getElementById(target)?.focus()
                }}
                className="text-dhis2-blue-800 underline"
            >
                {i18n.t('{{row}}, {{field}}: {{message}}', {
                    row,
                    field: fields.get(column) ?? column,
                    message: text,
                    interpolation: AS_IS,
                })}
            </a>
        </li>
    )
}

/** The form's messages, each a link to its cell, how many changes are not yet in DHIS2, and their download. */
export const DataEntrySummary = ({ className }: { className?: string }) => {
    const summary = useDataEntry((view) => view.summary)
    const signIn = useDataEntry((view) => view.sync === 'signIn')
    const downloadUnsent = useDataEntry((view) => view.downloadUnsent)
    const { tables } = useDataEntryContext()
    const { rows, fields } = useMemo(
        () => ({
            rows: new Map(
                tables.flatMap((table) =>
                    table.rows.map(({ id, label }) => [id, label])
                )
            ),
            fields: new Map(
                tables.flatMap((table) =>
                    table.columns.map(({ id, label }) => [id, label])
                )
            ),
        }),
        [tables]
    )
    return (
        <div
            className={cn(
                'flex flex-col gap-2 text-sm text-dhis2-grey-900',
                className
            )}
        >
            {signIn ? <p>{i18n.t('Sign in to keep saving')}</p> : null}
            {summary.items.length > 0 ? (
                <ul className="flex flex-col gap-1">
                    {summary.items.map((item, index) => (
                        <Item
                            key={`${item.key}-${index}`}
                            item={item}
                            rows={rows}
                            fields={fields}
                        />
                    ))}
                </ul>
            ) : null}
            {summary.unsent > 0 ? (
                <p>
                    {i18n.t('Not yet sent to DHIS2: {{changes}}', {
                        changes: formatCount(summary.unsent),
                    })}
                </p>
            ) : null}
            {summary.unsent + summary.failed > 0 ? (
                <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onClick={downloadUnsent}
                >
                    {i18n.t('Download unsent changes')}
                </Button>
            ) : null}
        </div>
    )
}
