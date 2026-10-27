import i18n from '@dhis2/d2-i18n'
import { useMemo, useState } from 'react'
import { useStore } from 'zustand'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/dhis2/ui/alert-dialog'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { cellDomId } from '../cells/cellProps'
import { formatCount } from '../cells/OptionCell'
import { rowLabel } from '../grid/headers'
import type { SummaryItem } from '../logic/summary'
import { cellKey } from '../model/types'
import { FORM_MESSAGES, useDataEntryContext } from '../provider/context'
import { useDataEntry } from '../provider/hooks'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'

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
    item: { key, kind, text, namesField },
    idScope,
    rows,
    fields,
}: {
    item: SummaryItem
    idScope: string
    rows: ReadonlyMap<string, string>
    fields: ReadonlyMap<string, string>
}) => {
    const dot = key.indexOf('.')
    const rowId = dot < 0 ? key : key.slice(0, dot)
    const row = rows.get(rowId) ?? rowId
    const className = cn('border-s-2 ps-2', TONES[kind])
    // A message without a field is the row's, or the whole form's: there is no cell to go to.
    if (dot < 0) {
        return (
            <li className={className}>
                {key === FORM_MESSAGES
                    ? text
                    : i18n.t('{{row}}: {{message}}', {
                          nsSeparator: '::',
                          row,
                          message: text,
                          interpolation: AS_IS,
                      })}
            </li>
        )
    }
    const column = key.slice(dot + 1)
    const target = cellDomId(idScope, cellKey(rowId, column))
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
                {namesField
                    ? i18n.t('{{row}}: {{message}}', {
                          nsSeparator: '::',
                          row,
                          message: text,
                          interpolation: AS_IS,
                      })
                    : i18n.t('{{row}}, {{field}}: {{message}}', {
                          nsSeparator: '::',
                          row,
                          field: fields.get(column) ?? column,
                          message: text,
                          interpolation: AS_IS,
                      })}
            </a>
        </li>
    )
}

/** Asks before the changes that could not be saved are dropped from the device. */
const DiscardFailed = ({ count }: { count: number }) => {
    const discardFailed = useDataEntry((view) => view.discardFailed)
    const [asking, setAsking] = useState(false)
    return (
        <>
            <Button
                variant="secondary"
                size="sm"
                onClick={() => setAsking(true)}
            >
                {i18n.t('Discard changes that could not be saved')}
            </Button>
            {asking ? (
                <AlertDialog open onOpenChange={setAsking}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {i18n.t('Discard {{changes}} changes?', {
                                    changes: formatCount(count),
                                })}
                            </AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogDescription>
                            {i18n.t(
                                'They are not saved anywhere else. Download them first to keep a copy.'
                            )}
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                            <AlertDialogCancel>
                                {i18n.t('Cancel')}
                            </AlertDialogCancel>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    setAsking(false)
                                    void discardFailed()
                                }}
                            >
                                {i18n.t('Discard')}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            ) : null}
        </>
    )
}

/**
 * The form's messages, each a link to its cell, how many changes are not yet in DHIS2, their download, and a way to
 * drop the ones that could not be saved.
 */
export const DataEntrySummary = ({ className }: { className?: string }) => {
    const summary = useDataEntry((view) => view.summary)
    const signIn = useDataEntry((view) => view.sync === 'signIn')
    const downloadUnsent = useDataEntry((view) => view.downloadUnsent)
    const { tables, store, settings, idScope } = useDataEntryContext()
    const cells = useStore(store, (state) => state.cells)
    const { rows, fields } = useMemo(
        () => ({
            // Named as the grid names them: by their event date once they have one.
            rows: new Map(
                tables.flatMap((table) =>
                    table.rows.map((row) => [
                        row.id,
                        rowLabel(
                            row,
                            cells[cellKey(row.id, EVENT_DATE_COLUMN)]?.value,
                            settings
                        ),
                    ])
                )
            ),
            fields: new Map(
                tables.flatMap((table) =>
                    table.columns.map(({ id, label }) => [id, label])
                )
            ),
        }),
        [tables, cells, settings]
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
                            idScope={idScope}
                            rows={rows}
                            fields={fields}
                        />
                    ))}
                </ul>
            ) : null}
            {summary.unsent > 0 ? (
                <p>
                    {i18n.t('Not yet sent to DHIS2: {{changes}}', {
                        nsSeparator: '::',
                        changes: formatCount(summary.unsent),
                    })}
                </p>
            ) : null}
            {summary.unsent + summary.failed > 0 ? (
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={downloadUnsent}
                    >
                        {i18n.t('Download unsent changes')}
                    </Button>
                    {summary.failed > 0 ? (
                        <DiscardFailed count={summary.failed} />
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}
