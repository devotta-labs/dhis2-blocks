import i18n from '@dhis2/d2-i18n'
import { memo } from 'react'
import { useStore } from 'zustand'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { useTallyContext } from './context'
import { formatCount } from './format'

/** What the whole sheet adds up to, as "12 marks". */
export const TallyTotal = memo(function TallyTotal({
    className,
}: {
    className?: string
}) {
    const { store } = useTallyContext('TallyTotal')
    const total = useStore(store, (state) => state.total)
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

/** "Edit counts", or "Cancel" and "Done" while the counts are being edited. */
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
                        onClick={() => finishEditing(true)}
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

/** Takes back this device's latest tap or set of corrections. Not shown while the counts are being edited. */
export const TallyUndoButton = memo(function TallyUndoButton({
    className,
}: {
    className?: string
}) {
    const { store, editing, undo } = useTallyContext('TallyUndoButton')
    const canUndo = useStore(store, (state) => state.canUndo)
    if (editing) return null
    return (
        <Button
            variant="outline"
            size="lg"
            data-slot="tally-undo"
            className={cn('self-start px-4', className)}
            disabled={!canUndo}
            focusableWhenDisabled
            onClick={undo}
        >
            {i18n.t('Undo last mark')}
        </Button>
    )
})
