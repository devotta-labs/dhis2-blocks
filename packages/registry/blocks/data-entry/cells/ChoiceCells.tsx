import i18n from '@dhis2/d2-i18n'
import { memo, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { useCellView, useDataEntryContext } from '../provider/context'
import { cellDomId } from './cellProps'
import type { CellComponent, ControlProps } from './cellProps'
import { CellStatus, describeCell } from './CellStatus'
import { CONTROL_CLASS, HIDDEN_CLASS, LOCKED_CLASS } from './TextCell'
import { navKeyOf } from './useCellMode'

const YES_NO_KEYS = new Map([
    ['y', 'true'],
    ['n', 'false'],
    ['delete', ''],
    ['backspace', ''],
])

// Keys with which a select opens its list.
const opensList = (event: KeyboardEvent) =>
    event.key === ' ' ||
    event.key === 'F4' ||
    (event.altKey && event.key.startsWith('Arrow'))

/** What a Yes/No field and a checkbox share: a value saved at once, their notes, and keys that only move. */
const useChoice = ({ cellKey, labelledBy, move, readOnly }: ControlProps) => {
    const { store } = useDataEntryContext()
    const view = useCellView(cellKey)
    const { notes, aria } = describeCell(cellKey, view, readOnly)
    // Escape hides the notes until the cell is next focused (WCAG 1.4.13).
    const [notesDismissed, setNotesDismissed] = useState(false)
    const locked = readOnly !== undefined
    return {
        view,
        locked,
        status: (
            <CellStatus view={view} notes={notes} dismissed={notesDismissed} />
        ),
        save(text: string) {
            if (!locked) {
                store.getState().commit(cellKey, text)
            }
        },
        controlProps: {
            ...aria,
            id: cellDomId(cellKey),
            'aria-labelledby': labelledBy,
            'aria-readonly': locked || undefined,
            onFocus: () => setNotesDismissed(false),
        },
        /** Arrows, Enter and Tab move, and Escape hides the notes; says whether it took the key. */
        navigate(event: KeyboardEvent) {
            const key = navKeyOf(event)
            if (key !== undefined) {
                if (key !== 'tab') {
                    event.preventDefault()
                }
                move(key)
                return true
            }
            if (event.key === 'Escape') {
                setNotesDismissed(true)
                return true
            }
            return false
        },
    }
}

/**
 * A Yes/No field as a native select: `y`, `n` and Delete set it straight away, arrows move, and Space opens the
 * list. Locked or hidden by a rule, it is the same select, so focus survives.
 */
export const BooleanCell = memo(function BooleanCell(props: ControlProps) {
    const { hidden = false } = props
    const { view, locked, status, save, controlProps, navigate } =
        useChoice(props)
    const value = hidden ? '' : (view.value ?? '')
    return (
        <div className="relative">
            <select
                {...controlProps}
                value={value}
                onChange={(event) => save(event.target.value)}
                onMouseDown={(event) => {
                    // A click selects a locked cell; its list does not open.
                    if (locked) {
                        event.preventDefault()
                        event.currentTarget.focus()
                    }
                }}
                onKeyDown={(event) => {
                    if (navigate(event)) {
                        return
                    }
                    if (opensList(event)) {
                        if (locked) {
                            event.preventDefault()
                        }
                        return
                    }
                    if (
                        event.key === 'Tab' ||
                        event.ctrlKey ||
                        event.metaKey ||
                        /^F\d/.test(event.key)
                    ) {
                        return
                    }
                    // Each key is its own action: the select's type-ahead would join keys typed within a second.
                    event.preventDefault()
                    const text = YES_NO_KEYS.get(event.key.toLowerCase())
                    if (text !== undefined) {
                        save(text)
                    }
                }}
                className={cn(
                    CONTROL_CLASS,
                    locked && LOCKED_CLASS,
                    hidden && HIDDEN_CLASS
                )}
            >
                {hidden ? (
                    <option value="">{i18n.t('Hidden')}</option>
                ) : (
                    <>
                        <option value="" />
                        <option value="true">{i18n.t('Yes')}</option>
                        <option value="false">{i18n.t('No')}</option>
                        {/* A stored value that is neither shows as it is, described by its warning. */}
                        {value === '' ||
                        value === 'true' ||
                        value === 'false' ? null : (
                            <option value={value}>{value}</option>
                        )}
                    </>
                )}
            </select>
            {status}
        </div>
    )
}) satisfies CellComponent

/**
 * A yes-only field as a native checkbox: Space and clicks toggle it between Yes and no value, arrows move. Locked or
 * hidden by a rule, it is the same checkbox, so focus survives.
 */
export const TrueOnlyCell = memo(function TrueOnlyCell(props: ControlProps) {
    const { hidden = false } = props
    const { view, locked, status, save, controlProps, navigate } =
        useChoice(props)
    const box = useRef<HTMLInputElement>(null)
    // A rule hid the answer: neither checked nor not, rather than "not checked".
    useLayoutEffect(() => {
        if (box.current !== null) {
            box.current.indeterminate = hidden
        }
    }, [hidden])
    return (
        <div
            className={cn(
                'relative flex h-9 items-center px-2 text-sm focus-within:bg-white focus-within:[anchor-name:--data-entry-cell] focus-within:shadow-[inset_0_0_0_2px_var(--color-dhis2-blue-600)] has-aria-invalid:not-focus-within:bg-dhis2-red-050 has-aria-invalid:not-focus-within:shadow-[inset_0_0_0_2px_var(--color-dhis2-red-600)]',
                locked && LOCKED_CLASS,
                hidden && HIDDEN_CLASS
            )}
        >
            <input
                {...controlProps}
                ref={box}
                type="checkbox"
                checked={!hidden && view.value === 'true'}
                onChange={(event) => save(event.target.checked ? 'true' : '')}
                onClick={(event) => {
                    if (locked) {
                        event.preventDefault()
                    }
                }}
                onKeyDown={navigate}
                className={cn(
                    'peer size-4 accent-dhis2-blue-600 outline-none',
                    hidden && 'sr-only'
                )}
            />
            {hidden ? <span aria-hidden="true">{i18n.t('Hidden')}</span> : null}
            {status}
        </div>
    )
}) satisfies CellComponent
