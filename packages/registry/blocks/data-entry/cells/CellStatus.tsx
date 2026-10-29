import i18n from '@dhis2/d2-i18n'
import { createContext, useContext } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import type { MessageKind } from '../logic/effects'
import type { SyncState } from '../model/types'
import type { CellView } from '../provider/context'
import type { ControlProps } from './cellProps'

type Tone = 'error' | 'warning' | 'info'

interface CellNote {
    id: string
    tone: Tone
    text: string
}

const TONES = {
    error: 'error',
    errorOnComplete: 'error',
    warning: 'warning',
    warningOnComplete: 'warning',
} satisfies Record<MessageKind, Tone>

// Reasons are shown as DHIS2 and the rules give them, not HTML-escaped.
const AS_IS = { escapeValue: false }

// Changes the outbox still holds: on this device, not yet in DHIS2.
const UNSENT = new Set<SyncState>(['queued', 'sending', 'waiting'])

/**
 * Everything to say about a cell, as separate notes: `reason` (why it cannot be edited) or `hint` (how to type it),
 * its errors and warnings, and whether it is saved. Each is its own element, so a screen reader reads them one after
 * another.
 */
const notesOf = (
    id: string,
    view: CellView,
    reason?: string,
    hint?: string
) => {
    const texts: Array<[Tone, string]> = []
    const about = reason ?? hint
    if (about !== undefined) {
        texts.push(['info', about])
    }
    if (view.error !== undefined) {
        texts.push(['error', view.error])
    }
    for (const { kind, text } of view.effects.messages) {
        texts.push([TONES[kind], text])
    }
    if (view.warning !== undefined) {
        texts.push(['warning', view.warning])
    }
    if (view.sync === 'failed') {
        texts.push([
            'error',
            i18n.t('Not saved: {{reason}}', {
                nsSeparator: '::',
                reason: view.reason ?? '',
                interpolation: AS_IS,
            }),
        ])
    } else if (UNSENT.has(view.sync)) {
        if (view.reason !== undefined) {
            texts.push(['info', view.reason])
        }
        texts.push(['info', i18n.t('Saved on this device')])
    }
    return texts.map(([tone, text], index): CellNote => ({
        id: `${id}-note-${index}`,
        tone,
        text,
    }))
}

/** The notes of the cell whose control has `id`, and the ARIA attributes that carry them, for that control. */
export const describeCell = (
    id: string,
    view: CellView,
    reason?: string,
    hint?: string
) => {
    const notes = notesOf(id, view, reason, hint)
    const invalid =
        view.error !== undefined ||
        view.effects.messages.some(({ kind }) => kind === 'error')
    return {
        notes,
        aria: {
            'aria-required': view.effects.required || undefined,
            'aria-invalid': invalid || undefined,
            'aria-describedby':
                notes.length > 0
                    ? notes.map(({ id }) => id).join(' ')
                    : undefined,
        } satisfies ControlProps['aria'],
    }
}

// A quiet ring while sending, a solid dot once saved on this device, a red square when refused: told apart by shape,
// not only colour.
const MARKERS = new Map<SyncState, string>([
    ['sending', 'rounded-full border-2 border-dhis2-grey-600'],
    ['queued', 'rounded-full bg-dhis2-blue-700'],
    ['waiting', 'rounded-full bg-dhis2-blue-700'],
    ['failed', 'bg-dhis2-red-600'],
])

interface BoundCell {
    view: CellView
    /** Whether the cell's notes show. */
    shown: boolean
    show(): void
}

/**
 * What `Cell` tells the control it wraps: the cell's view, so the default controls subscribe to nothing, and whether
 * its notes show. Escape hides them until focus next enters the cell (WCAG 1.4.13). A control that takes Escape for
 * itself calls `preventDefault`; else the cell hides its notes.
 */
export const CellContext = createContext<BoundCell | undefined>(undefined)

export const useCellContext = (): BoundCell => {
    const bound = useContext(CellContext)
    if (bound === undefined) {
        throw new Error('Default controls must be used inside Cell.')
    }
    return bound
}

/**
 * Places a popover under its cell, above the grid's sticky headers. Where the browser has anchor positioning it is
 * fixed to the focused cell, so a scrolling table does not clip it, and it opens above when there is no room below.
 * Elsewhere it hangs under the cell inside the table, and scrolls into view with it.
 */
export const POPOVER_CLASS =
    'absolute start-0 top-full supports-[anchor-name:--a]:fixed supports-[anchor-name:--a]:[position-anchor:--data-entry-cell] supports-[anchor-name:--a]:[top:anchor(bottom)] supports-[anchor-name:--a]:[inset-inline-start:anchor(start)] supports-[anchor-name:--a]:[position-try-fallbacks:flip-block,flip-inline,flip-block_flip-inline]'

const NOTE_TONES = {
    error: 'border-dhis2-red-300',
    warning: 'border-dhis2-yellow-300',
    info: 'border-dhis2-grey-500',
} satisfies Record<Tone, string>

/**
 * What a cell shows besides its value: the required marker, whether it is saved, an amber outline for a warning, and
 * the notes while focus is in the cell (until Escape hides them). It sits after the control, in `Cell`'s `group/cell`.
 */
export const CellStatus = ({
    view,
    notes,
    dismissed,
}: {
    view: CellView
    notes: ReadonlyArray<CellNote>
    /** Escape hid the notes until the control is next focused. */
    dismissed: boolean
}) => {
    const marker = MARKERS.get(view.sync)
    const warned =
        notes.some(({ tone }) => tone === 'warning') &&
        !notes.some(({ tone }) => tone === 'error')
    return (
        <>
            {view.effects.required ? (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute start-0.5 top-0 text-xs text-dhis2-red-700"
                >
                    *
                </span>
            ) : null}
            {marker === undefined ? null : (
                <span
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute end-1 top-1 size-2',
                        marker
                    )}
                />
            )}
            {warned ? (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_2px_var(--color-dhis2-yellow-700)] group-focus-within/cell:hidden"
                />
            ) : null}
            {notes.length > 0 ? (
                <span
                    className={cn(
                        POPOVER_CLASS,
                        'pointer-events-none z-40 hidden w-max max-w-72 flex-col gap-0.5 rounded-dhis2-sm bg-dhis2-grey-900 px-2 py-1 text-xs text-white',
                        !dismissed && 'group-focus-within/cell:flex',
                        // An open editor covers the cell's place below it.
                        'group-has-[[role=dialog]]/cell:hidden'
                    )}
                >
                    {notes.map(({ id, tone, text }) => (
                        <span
                            key={id}
                            id={id}
                            className={cn(
                                'border-s-2 ps-1.5',
                                NOTE_TONES[tone]
                            )}
                        >
                            {text}
                        </span>
                    ))}
                </span>
            ) : null}
        </>
    )
}
