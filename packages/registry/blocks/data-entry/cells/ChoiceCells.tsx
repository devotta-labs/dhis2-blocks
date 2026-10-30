import i18n from '@dhis2/d2-i18n'
import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import type { CellComponent, ControlProps } from './cellProps'
import { useCellContext } from './CellStatus'
import { OptionCell } from './OptionCell'
import { HIDDEN_CLASS, LOCKED_CLASS } from './TextCell'
import { navKeyOf } from './useCellMode'

const YES_NO_KEYS = new Map([
    ['y', 'true'],
    ['n', 'false'],
    ['delete', ''],
    ['backspace', ''],
])

/** A checkbox's control: a value saved at once, and keys that only move. */
const useChoice = ({ id, labelledBy, move, readOnly, aria }: ControlProps) => {
    const { view } = useCellContext()
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
 * A Yes/No field as an option cell with two options, so it lists and picks like any option set: `y`, `n` and Delete
 * set it straight away in Ready, arrows move, and F4 or Alt+Down lists both.
 */
export const BooleanCell = memo(function BooleanCell(props: ControlProps) {
    const { field } = props
    const yesNo = useMemo(
        () => ({
            ...field,
            options: [
                { code: 'true', name: i18n.t('Yes') },
                { code: 'false', name: i18n.t('No') },
            ],
        }),
        [field]
    )
    return <OptionCell {...props} field={yesNo} quickKeys={YES_NO_KEYS} />
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
                'flex h-full min-h-9 items-center px-2 text-sm focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_var(--color-dhis2-blue-600)] has-aria-invalid:not-focus-within:bg-dhis2-red-050 has-aria-invalid:not-focus-within:shadow-[inset_0_0_0_2px_var(--color-dhis2-red-600)]',
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
