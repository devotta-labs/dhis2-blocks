import i18n from '@dhis2/d2-i18n'
import { memo, useMemo, useState } from 'react'
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
import {
    cellDomId,
    formatCount,
    cellKey,
    useFocusCell,
} from '@/components/spreadsheet'
import { fieldNamer } from '../logic/summary'
import type { SummaryItem } from '../logic/summary'
import { rowsByRecord } from '../model/types'
import type { TrackerRow } from '../model/types'
import { FORM_MESSAGES } from '../logic/effects'
import { useTrackerDataEntry, useTrackerContext } from '../provider/hooks'
import { useRowLabel } from '../provider/TrackerRowLabel'

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

interface ItemProps {
    /** The item's cell, or its row for a message without a field. */
    itemKey: SummaryItem['key']
    kind: SummaryItem['kind']
    text: string
    namesField?: true
    idScope: string
    rows: ReadonlyMap<string, TrackerRow>
    /** A cell's field's name. */
    nameOf(key: string): string
}

/**
 * One message, naming its row as the grid does (by the row's event date once it has one, a person by their name) and
 * its field by the heading of its column. It reads only the cells that name its row, and takes plain props, so it
 * draws again only when its own message or its row's name changes.
 */
const Item = memo(function Item({
    itemKey: key,
    kind,
    text,
    namesField,
    idScope,
    rows,
    nameOf,
}: ItemProps) {
    const focusCell = useFocusCell()
    const dot = key.indexOf('.')
    const rowId = dot < 0 ? key : key.slice(0, dot)
    // The row that shows the record, named as the grid names it.
    const label = useRowLabel(rows.get(rowId))
    const row = label ?? rowId
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
    const cell = cellKey(rowId, column)
    const target = cellDomId(idScope, cell)
    return (
        <li className={className}>
            <a
                href={`#${target}`}
                onClick={(event) => {
                    // Focus moves without touching the address, which some apps route by.
                    event.preventDefault()
                    focusCell(cell)
                }}
                // At least 24 px tall, as WCAG 2.2 asks of a target with others close by.
                className="inline-block py-1 text-dhis2-blue-800 underline"
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
                          field: nameOf(key),
                          message: text,
                          interpolation: AS_IS,
                      })}
            </a>
        </li>
    )
})

/** Asks before the changes that could not be saved are dropped from the device. */
const DiscardFailed = ({ count }: { count: number }) => {
    const discardFailed = useTrackerDataEntry((view) => view.discardFailed)
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
export const TrackerDataEntrySummary = ({
    className,
}: {
    className?: string
}) => {
    const summary = useTrackerDataEntry((view) => view.summary)
    const signIn = useTrackerDataEntry((view) => view.sync === 'signIn')
    const downloadUnsent = useTrackerDataEntry((view) => view.downloadUnsent)
    const { tables, fieldNames, idScope } = useTrackerContext()
    const { rows, nameOf } = useMemo(
        () => ({
            rows: rowsByRecord(tables),
            nameOf: fieldNamer(tables, fieldNames),
        }),
        [tables, fieldNames]
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
                            itemKey={item.key}
                            kind={item.kind}
                            text={item.text}
                            namesField={item.namesField}
                            idScope={idScope}
                            rows={rows}
                            nameOf={nameOf}
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
