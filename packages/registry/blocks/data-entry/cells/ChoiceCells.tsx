import i18n from '@dhis2/d2-i18n'
import { memo, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { useCellView } from '../provider/context'
import type { CellComponent, ControlProps } from './cellProps'
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

/** What a Yes/No field and a checkbox share: a value saved at once, and keys that only move. */
const useChoice = ({
    id,
    cellKey,
    labelledBy,
    move,
    readOnly,
    aria,
}: ControlProps) => {
    const view = useCellView(cellKey)
    const locked = readOnly !== undefined
    return {
        view,
        locked,
        // `commit` reads the cell's lock as it saves: a rule may have locked it since it was drawn.
        save: (text: string) => view.commit(text),
        controlProps: {
            ...aria,
            id,
            'aria-labelledby': labelledBy,
            'aria-readonly': locked || undefined,
            // Always in Ready: a paste and Ctrl+Z are the grid's.
            'data-mode': 'ready',
        },
        /** Arrows, Enter and Tab move, and Escape is left to the cell, which hides its notes; says whether it took the key. */
        navigate(event: KeyboardEvent) {
            const key = navKeyOf(event)
            if (key !== undefined) {
                if (key !== 'tab') {
                    event.preventDefault()
                }
                move(key)
                return true
            }
            return event.key === 'Escape'
        },
    }
}

/**
 * A Yes/No field as a native select: `y`, `n` and Delete set it straight away, arrows move, and Space opens the
 * list. Locked or hidden by a rule, it is the same select, so focus survives.
 */
export const BooleanCell = memo(function BooleanCell(props: ControlProps) {
    const { hidden = false } = props
    const { view, locked, save, controlProps, navigate } = useChoice(props)
    const value = hidden ? '' : (view.value ?? '')
    return (
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
    )
}) satisfies CellComponent

/**
 * A yes-only field as a native checkbox: Space and clicks toggle it between Yes and no value, Delete clears it, arrows
 * move. Locked or hidden by a rule, it is the same checkbox, so focus survives.
 */
export const TrueOnlyCell = memo(function TrueOnlyCell(props: ControlProps) {
    const { hidden = false } = props
    const { view, locked, save, controlProps, navigate } = useChoice(props)
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
                'flex h-9 items-center px-2 text-sm focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_var(--color-dhis2-blue-600)] has-aria-invalid:not-focus-within:bg-dhis2-red-050 has-aria-invalid:not-focus-within:shadow-[inset_0_0_0_2px_var(--color-dhis2-red-600)]',
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
                onKeyDown={(event) => {
                    if (
                        !navigate(event) &&
                        (event.key === 'Delete' || event.key === 'Backspace')
                    ) {
                        event.preventDefault()
                        save('')
                    }
                }}
                className={cn(
                    'size-4 accent-dhis2-blue-600 outline-none',
                    hidden && 'sr-only'
                )}
            />
            {hidden ? <span aria-hidden="true">{i18n.t('Hidden')}</span> : null}
        </div>
    )
}) satisfies CellComponent
