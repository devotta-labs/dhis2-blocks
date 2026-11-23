import { useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, MouseEvent } from 'react'
import { composing } from '@/components/dhis2-value-input'
import type { NavKey } from '../grid/navigation'
import type { CommitResult } from '../model/types'
import { useCellContext } from './CellStatus'

/** Excel's three modes: Ready (selected, no cursor), Enter (typing) and Edit (inside the text). */
export type CellMode = 'ready' | 'enter' | 'edit'

/** No cursor and no highlight: the cell is selected, not yet being typed in. */
export const READY_CLASS = 'caret-transparent selection:bg-transparent'

/** Whether the control is a text cell being typed in (Enter or Edit); any other cell is in Ready. */
export const typingIn = (control: HTMLElement) =>
    control.dataset.mode === 'enter' || control.dataset.mode === 'edit'

/** The move a plain arrow, Enter or Tab asks for; a key with a modifier belongs to the browser. */
export const navKeyOf = (event: KeyboardEvent) => {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
        return undefined
    }
    switch (event.key) {
        case 'ArrowUp':
            return 'up'
        case 'ArrowDown':
            return 'down'
        case 'ArrowLeft':
            return 'left'
        case 'ArrowRight':
            return 'right'
        case 'Enter':
            return 'enter'
        case 'Tab':
            return 'tab'
    }
}

/** Ctrl+Enter or ⌘+Enter: the grid adds a row to the cell's table. */
export const addsRow = (event: KeyboardEvent) =>
    event.key === 'Enter' &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    !composing(event)

interface CellModeOptions {
    /** Saves what was typed and says how the store took it; `undefined` when nothing was typed. */
    commit(): CommitResult | undefined
    /** Drops what was typed, and a refused text the store kept. */
    revert(): void
    move(key: NavKey): void
    /** The cell cannot be edited: it stays in Ready. */
    readOnly: boolean
}

/** The modes and keys of a cell holding text: what each key does is the spec's key table. */
export const useCellMode = ({
    commit,
    revert,
    move,
    readOnly,
}: CellModeOptions) => {
    const [state, setMode] = useState<CellMode>('ready')
    const mode = readOnly ? 'ready' : state
    const notes = useCellContext()
    const ref = useRef<HTMLInputElement>(null)
    useLayoutEffect(() => {
        const input = ref.current
        if (
            input !== null &&
            mode === 'ready' &&
            input.ownerDocument.activeElement === input
        ) {
            input.select()
        }
    }, [mode])
    const edit = (input: HTMLInputElement) => {
        if (!readOnly) {
            setMode('edit')
            input.setSelectionRange(input.value.length, input.value.length)
        }
    }
    return {
        mode,
        typed: () => setMode((now) => (now === 'ready' ? 'enter' : now)),
        ready: () => setMode('ready'),
        inputProps: {
            ref,
            'data-mode': mode,
            onFocus(event: FocusEvent<HTMLInputElement>) {
                setMode('ready')
                event.currentTarget.select()
            },
            onMouseDown(event: MouseEvent<HTMLInputElement>) {
                const input = event.currentTarget
                if (input.ownerDocument.activeElement !== input) {
                    event.preventDefault()
                    input.focus()
                } else if (readOnly) {
                    event.preventDefault()
                } else if (
                    mode !== 'edit' &&
                    event.button === 0 &&
                    !event.ctrlKey
                ) {
                    setMode('edit')
                }
            },
            onDoubleClick: (event: MouseEvent<HTMLInputElement>) =>
                edit(event.currentTarget),
            onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
                if (composing(event)) {
                    return
                }
                const key = navKeyOf(event)
                if (key !== undefined) {
                    if (
                        mode === 'edit' &&
                        (key === 'left' || key === 'right')
                    ) {
                        return
                    }
                    if (key !== 'tab') {
                        event.preventDefault()
                    }
                    if (commit() === 'invalid' && key !== 'tab') {
                        setMode('edit')
                        notes.show()
                    } else {
                        move(key)
                        setMode('ready')
                    }
                } else if (addsRow(event)) {
                    if (commit() === 'invalid') {
                        event.preventDefault()
                        setMode('edit')
                        notes.show()
                    } else {
                        setMode('ready')
                    }
                } else if (event.key === 'F2') {
                    event.preventDefault()
                    edit(event.currentTarget)
                } else if (event.key === 'Escape') {
                    if (mode !== 'ready' || !notes.shown) {
                        event.preventDefault()
                        revert()
                        setMode('ready')
                    }
                }
            },
        },
    }
}
