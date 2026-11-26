import i18n from '@dhis2/d2-i18n'
import { memo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useStore } from 'zustand'
import { cn } from '@/components/dhis2/ui/cn'
import { Input } from '@/components/dhis2/ui/input'
import { useTallyContext } from './context'
import type { EditSession } from './context'
import { countDraft, formatCount } from './format'
import { columnHeaderIds } from './headers'

const CELL_CLASS = 'p-1 align-middle'
const SIZE_CLASS = 'h-20 w-full min-w-[4.5rem]'

const CLOSED_CLASS = cn(
    SIZE_CLASS,
    'flex items-center justify-center rounded-dhis2-md border border-dhis2-border bg-dhis2-background bg-[repeating-linear-gradient(135deg,var(--dhis2-border-strong)_0_1px,transparent_1px_7px)] contrast-more:bg-[repeating-linear-gradient(135deg,var(--dhis2-border-strong)_0_2px,transparent_2px_9px)] forced-colors:border-dashed forced-colors:border-[GrayText]'
)

const TAP_CLASS = cn(
    SIZE_CLASS,
    'flex cursor-pointer touch-manipulation items-center justify-center rounded-dhis2-md border border-dhis2-input bg-dhis2-background font-medium text-dhis2-foreground tabular-nums select-none [-webkit-tap-highlight-color:transparent] [transition:background-color_200ms_cubic-bezier(0.23,1,0.32,1),transform_120ms_cubic-bezier(0.23,1,0.32,1)] hover:border-dhis2-control active:scale-[0.97] active:bg-dhis2-info-fill active:[transition:none] motion-reduce:[transition:background-color_200ms_cubic-bezier(0.23,1,0.32,1)] motion-reduce:active:scale-100 motion-reduce:active:[transition:none] focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring'
)

const NOTHING_CLASS = 'font-normal text-dhis2-subtle-foreground'

const sizeOf = (digits: number) => {
    if (digits >= 6) return 'text-lg'
    return digits === 5 ? 'text-xl' : 'text-2xl'
}

const digitsOf = (count: number) => String(Math.trunc(count)).length

const ignoreHeldKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
    }
}

const TapCell = memo(function TapCell({
    cell,
    firstOpen,
}: {
    cell: number
    firstOpen: boolean
}) {
    const { store, ids, pointer, tapCell } = useTallyContext('TallyGrid')
    const count = useStore(store, (state) => state.counts[cell] ?? 0)
    const isStop = useStore(pointer.tabStop, ({ tabStop }) =>
        tabStop === undefined ? firstOpen : tabStop === cell
    )
    return (
        <td data-cell={cell} className={CELL_CLASS}>
            <button
                id={ids.cell(cell)}
                type="button"
                tabIndex={isStop ? 0 : -1}
                className={cn(
                    TAP_CLASS,
                    sizeOf(digitsOf(count)),
                    count === 0 && NOTHING_CLASS
                )}
                onKeyDown={ignoreHeldKeys}
                onClick={() => tapCell(cell)}
            >
                {formatCount(count)}
            </button>
        </td>
    )
})

const ClosedCell = memo(function ClosedCell({ cell }: { cell: number }) {
    const { store } = useTallyContext('TallyGrid')
    const count = useStore(store, (state) => state.counts[cell] ?? 0)
    return (
        <td data-cell={cell} className={CELL_CLASS}>
            <div data-slot="tally-closed" className={CLOSED_CLASS}>
                {count > 0 ? (
                    <span
                        className={cn(
                            'rounded-dhis2-sm bg-dhis2-background px-1.5 font-medium text-dhis2-foreground tabular-nums',
                            sizeOf(digitsOf(count))
                        )}
                    >
                        {formatCount(count)}
                    </span>
                ) : null}
                <span className="sr-only">{i18n.t('Not used')}</span>
            </div>
        </td>
    )
})

const EditCell = memo(function EditCell({
    cell,
    session,
}: {
    cell: number
    session: EditSession
}) {
    const { ids, levels, index, groupIds } = useTallyContext('TallyGrid')
    const shown = String(session.counts[cell] ?? 0)
    const [draft, setDraft] = useState(shown)
    const row = Math.floor(cell / index.columns.length)
    const column = cell % index.columns.length
    const labelledBy = [
        ...(groupIds[row] === undefined ? [] : [groupIds[row]]),
        ids.row(row),
        ...columnHeaderIds(levels, ids, column),
    ].join(' ')
    return (
        <td data-cell={cell} className={CELL_CLASS}>
            <Input
                id={ids.cell(cell)}
                data-cell={cell}
                inputMode="numeric"
                autoComplete="off"
                aria-labelledby={labelledBy}
                value={draft}
                className={cn(
                    SIZE_CLASS,
                    'rounded-dhis2-md text-center font-medium tabular-nums shadow-none',
                    sizeOf(draft.length)
                )}
                onChange={(event) => {
                    const next = countDraft(event.target.value)
                    setDraft(next)
                    session.drafts.set(cell, next)
                }}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={() => {
                    if (draft === '') {
                        setDraft(shown)
                        session.drafts.delete(cell)
                    }
                }}
            />
        </td>
    )
})

/** One cell of the grid: a count button, a number field while editing, or a hatched cell that is never marked. */
export const TallyCell = memo(function TallyCell({
    cell,
    firstOpen,
}: {
    cell: number
    firstOpen: boolean
}) {
    const { index, session } = useTallyContext('TallyGrid')
    const closed = index.isClosed(cell)
    if (session && (!closed || (session.counts[cell] ?? 0) > 0)) {
        return <EditCell key={session.round} cell={cell} session={session} />
    }
    if (closed) return <ClosedCell cell={cell} />
    return <TapCell cell={cell} firstOpen={firstOpen} />
})
