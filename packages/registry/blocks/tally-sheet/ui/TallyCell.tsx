import i18n from '@dhis2/d2-i18n'
import { memo, useCallback, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useStore } from 'zustand'
import { cn } from '@/components/dhis2/ui/cn'
import { Input } from '@/components/dhis2/ui/input'
import { useTallyContext } from './context'
import type { EditSession } from './context'
import { countDraft, formatCount } from './format'
import { columnHeaderIds } from './headers'
import { ScrubReadout, useScrub } from './scrub'

const CELL_CLASS = 'p-1 align-middle'
const SIZE_CLASS = 'h-20 w-full min-w-[4.5rem]'

const CLOSED_CLASS = cn(
    SIZE_CLASS,
    'flex items-center justify-center rounded-dhis2-md border border-dhis2-border bg-dhis2-background bg-[repeating-linear-gradient(135deg,var(--dhis2-border-strong)_0_1px,transparent_1px_7px)] contrast-more:bg-[repeating-linear-gradient(135deg,var(--dhis2-border-strong)_0_2px,transparent_2px_9px)] forced-colors:border-dashed forced-colors:border-[GrayText]'
)

const TAP_CLASS = cn(
    SIZE_CLASS,
    'relative flex cursor-pointer touch-manipulation items-center justify-center rounded-dhis2-md border border-dhis2-input bg-dhis2-background font-medium text-dhis2-foreground tabular-nums select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [transition:background-color_200ms_cubic-bezier(0.23,1,0.32,1),transform_120ms_cubic-bezier(0.23,1,0.32,1)] hover:border-dhis2-control active:scale-(--tally-press) active:bg-dhis2-info-fill active:[transition:none] motion-reduce:[transition:background-color_200ms_cubic-bezier(0.23,1,0.32,1)] motion-reduce:active:scale-100 motion-reduce:active:[transition:none] focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring'
)

const TAP_KEYS: ReadonlySet<string> = new Set(['Enter', ' '])
const NOTHING_CLASS = 'font-normal text-dhis2-subtle-foreground'

const sizeOf = (digits: number) => {
    if (digits >= 6) return 'text-lg'
    return digits === 5 ? 'text-xl' : 'text-2xl'
}

const digitsOf = (count: number) => String(Math.trunc(count)).length

const SCRUB_CLASS =
    'data-[scrubbing]:z-10 data-[scrubbing]:scale-(--tally-lift) data-[scrubbing]:cursor-move data-[axis=across]:cursor-ew-resize data-[axis=up]:cursor-ns-resize data-[scrubbing]:border-dhis2-primary data-[scrubbing]:bg-dhis2-background data-[scrubbing]:shadow-dhis2-popover data-[scrubbing]:[transition:scale_160ms_cubic-bezier(0.23,1,0.32,1),box-shadow_160ms_cubic-bezier(0.23,1,0.32,1)] data-[scrubbing]:active:scale-(--tally-lift) data-[scrubbing]:active:bg-dhis2-background data-[scrubbing]:active:[transition:scale_160ms_cubic-bezier(0.23,1,0.32,1),box-shadow_160ms_cubic-bezier(0.23,1,0.32,1)] motion-reduce:data-[scrubbing]:scale-100 motion-reduce:data-[scrubbing]:[transition:none] motion-reduce:data-[scrubbing]:active:scale-100 motion-reduce:data-[scrubbing]:active:[transition:none]'

const ARROW_CLASS = {
    start: 'start-1.5 rotate-180 rtl:rotate-0',
    end: 'end-1.5 rtl:rotate-180',
    up: 'top-1 -rotate-90',
    down: 'bottom-1 rotate-90',
}

const ARROWS = {
    across: ['start', 'end'],
    up: ['up', 'down'],
    either: ['start', 'end', 'up', 'down'],
} as const

const SlideArrows = ({ axis }: { axis: 'across' | 'up' | undefined }) =>
    ARROWS[axis ?? 'either'].map((side) => (
        <svg
            key={side}
            aria-hidden="true"
            viewBox="0 0 16 16"
            className={cn(
                'absolute size-3 fill-none stroke-current text-dhis2-input',
                ARROW_CLASS[side]
            )}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m6 3 5 5-5 5" />
        </svg>
    ))

const TapCell = memo(function TapCell({
    cell,
    firstOpen,
}: {
    cell: number
    firstOpen: boolean
}) {
    const { store, ids, pointer, tapCell, adjustCell } =
        useTallyContext('TallyGrid')
    const count = useStore(store, (state) => state.counts[cell] ?? 0)
    const isStop = useStore(pointer.tabStop, ({ tabStop }) =>
        tabStop === undefined ? firstOpen : tabStop === cell
    )
    const adjust = useCallback(
        (delta: number) => adjustCell(cell, delta),
        [adjustCell, cell]
    )
    const { scrub, takeClick, handlers, dropOnEscape } = useScrub(count, adjust)
    const shown = count + (scrub.delta ?? 0)
    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (dropOnEscape(event)) return
        const adds = event.key === '+' || event.key === '='
        const takes = event.key === '-' || event.key === '_'
        if (event.repeat && (adds || takes || TAP_KEYS.has(event.key))) {
            event.preventDefault()
            return
        }
        if (adds) tapCell(cell)
        if (takes && count > 0) adjustCell(cell, -1)
    }
    return (
        <td data-cell={cell} className={CELL_CLASS}>
            <button
                id={ids.cell(cell)}
                type="button"
                tabIndex={isStop ? 0 : -1}
                aria-keyshortcuts="+ -"
                data-scrubbing={scrub.delta === undefined ? undefined : ''}
                data-axis={scrub.axis}
                className={cn(
                    TAP_CLASS,
                    SCRUB_CLASS,
                    sizeOf(digitsOf(shown)),
                    shown === 0 && NOTHING_CLASS
                )}
                onKeyDown={onKeyDown}
                onClick={() => {
                    if (!takeClick()) tapCell(cell)
                }}
                {...handlers}
            >
                {formatCount(shown)}
                {scrub.delta === undefined ? null : (
                    <SlideArrows axis={scrub.axis} />
                )}
            </button>
            {scrub.delta === undefined ? null : <ScrubReadout scrub={scrub} />}
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
