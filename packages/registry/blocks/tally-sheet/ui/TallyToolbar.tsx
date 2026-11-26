import i18n from '@dhis2/d2-i18n'
import { memo } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { useTallyContext } from './context'
import { formatCount } from './format'
import { useCanUndo, useSheetTotal } from './state'

/** What the whole sheet adds up to, as "12 marks". */
export const TallyTotal = memo(function TallyTotal({
    className,
}: {
    className?: string
}) {
    const total = useSheetTotal('TallyTotal')
    return (
        <p
            data-slot="tally-total"
            dir="auto"
            className={cn(
                'm-0 text-sm text-dhis2-muted-foreground tabular-nums',
                className
            )}
        >
            {total === 1
                ? i18n.t('{{marks}} mark', { marks: formatCount(total) })
                : i18n.t('{{marks}} marks', { marks: formatCount(total) })}
        </p>
    )
})

/**
 * "Edit counts", or "Cancel" and "Done" while the counts are being edited. Done lands where Edit counts was, so the
 * second click of a double click is not taken as Done.
 */
export const TallyEditButtons = memo(function TallyEditButtons({
    className,
}: {
    className?: string
}) {
    const { editing, setEditing, finishEditing, ids } =
        useTallyContext('TallyEditButtons')
    return (
        <div
            data-slot="tally-edit-buttons"
            className={cn('flex items-center gap-2', className)}
        >
            {editing ? (
                <>
                    <Button
                        variant="outline"
                        size="sm"
                        className="px-2.5"
                        onClick={() => finishEditing(false)}
                    >
                        {i18n.t('Cancel')}
                    </Button>
                    <Button
                        size="sm"
                        className="px-2.5"
                        onClick={(event) => {
                            if (event.detail <= 1) finishEditing(true)
                        }}
                    >
                        {i18n.t('Done')}
                    </Button>
                </>
            ) : (
                <Button
                    id={ids.edit}
                    variant="outline"
                    size="sm"
                    className="px-2.5"
                    onClick={() => setEditing(true)}
                >
                    {i18n.t('Edit counts')}
                </Button>
            )}
        </div>
    )
})

/** Takes back this device's latest tap or set of corrections. Disabled while the counts are being edited. */
export const TallyUndoButton = memo(function TallyUndoButton({
    className,
}: {
    className?: string
}) {
    const { editing, undo } = useTallyContext('TallyUndoButton')
    const canUndo = useCanUndo('TallyUndoButton')
    return (
        <Button
            variant="ghost"
            size="sm"
            data-slot="tally-undo"
            aria-label={i18n.t('Undo last mark')}
            className={cn('self-start px-2.5', className)}
            disabled={!canUndo || editing}
            focusableWhenDisabled
            onClick={undo}
        >
            {i18n.t('Undo')}
        </Button>
    )
})

/**
 * The bar a sheet sits under: its title at the start, Undo and Edit counts at the end, and whatever it is given
 * between them. The title is the sheet's `label`. The bar is tinted while the counts are being edited.
 */
export const TallyToolbar = memo(function TallyToolbar({
    className,
    children,
}: {
    className?: string
    children?: ReactNode
}) {
    const { label, editing } = useTallyContext('TallyToolbar')
    return (
        <div
            data-slot="tally-toolbar"
            data-editing={editing ? '' : undefined}
            className={cn(
                'flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-dhis2-md bg-dhis2-muted py-1.5 ps-3 pe-1.5 data-[editing]:bg-dhis2-info-subtle',
                className
            )}
        >
            <p
                dir="auto"
                className="m-0 min-w-0 truncate text-sm font-medium text-dhis2-foreground"
            >
                {label}
            </p>
            {children}
            <div className="ms-auto flex items-center gap-1">
                <TallyUndoButton />
                <TallyEditButtons />
            </div>
        </div>
    )
})
