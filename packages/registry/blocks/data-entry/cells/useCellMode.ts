import { useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, MouseEvent } from 'react'
import type { NavKey } from '../grid/navigation'
import type { CommitResult } from '../model/types'

/** Excel's three modes: Ready (selected, no cursor), Enter (typing) and Edit (inside the text). */
export type CellMode = 'ready' | 'enter' | 'edit'

/** No cursor and no highlight: the cell is selected, not yet being typed in. */
export const READY_CLASS = 'caret-transparent selection:bg-transparent'

/** Whether the control is a text cell being typed in (Enter or Edit); any other cell is in Ready. */
export const typingIn = (control: HTMLElement) =>
    control.dataset.mode === 'enter' || control.dataset.mode === 'edit'

// Safari reports the key that ends a composition as keyCode 229 with `isComposing` already false.
export const composing = (event: KeyboardEvent) =>
    event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229

/** The move a plain arrow, Enter or Tab asks for; a key with a modifier belongs to the browser. */
export const navKeyOf = (event: KeyboardEvent): NavKey | undefined => {
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

interface CellModeOptions {
    /** Saves what was typed and says how the store took it; `undefined` when nothing was typed. */
    commit(): CommitResult | undefined
    /** Drops what was typed, and a refused text the store kept. */
    revert(): void
    move(key: NavKey): void
    /** The cell cannot be edited: it stays in Ready. */
    readOnly: boolean
    /** Whether the cell has notes to show while it has focus. */
    hasNotes: boolean
}

/** The modes and keys of a cell holding text: what each key does is the spec's key table. */
export const useCellMode = ({
    commit,
    revert,
    move,
    readOnly,
    hasNotes,
}: CellModeOptions) => {
    const [state, setMode] = useState<CellMode>('ready')
    const mode = readOnly ? 'ready' : state
    // Escape hides the notes until the cell is next focused (WCAG 1.4.13).
    const [notesDismissed, setNotesDismissed] = useState(false)
    const ref = useRef<HTMLInputElement>(null)
    // Back in Ready (Escape, a save that went nowhere) the text is selected again once it shows the stored value.
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
        notesDismissed,
        /** Typing in Ready starts Enter. */
        typed: () => setMode((now) => (now === 'ready' ? 'enter' : now)),
        /** Back to Ready, the value selected: a pick from a list was saved without moving. */
        ready: () => setMode('ready'),
        inputProps: {
            ref,
            // The grid reads it: Ready-mode paste and Ctrl+Z are the grid's, typing keeps the browser's.
            'data-mode': mode,
            onFocus(event: FocusEvent<HTMLInputElement>) {
                setMode('ready')
                setNotesDismissed(false)
                event.currentTarget.select()
            },
            onMouseDown(event: MouseEvent<HTMLInputElement>) {
                const input = event.currentTarget
                if (input.ownerDocument.activeElement !== input) {
                    // A click only selects the cell: some browsers would put a cursor after the selection.
                    event.preventDefault()
                    input.focus()
                } else if (readOnly) {
                    // A locked cell stays selected, so copying it still copies the whole value.
                    event.preventDefault()
                } else if (mode !== 'edit') {
                    // A click inside the text edits it, as in Excel.
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
                    // Inside the text, left and right move the cursor.
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
                        // Nothing is lost, but the text is not a value: stay and fix it, with its error shown.
                        setMode('edit')
                        setNotesDismissed(false)
                    } else {
                        move(key)
                        // At the grid's edge nothing moves; the cell is selected again.
                        setMode('ready')
                    }
                } else if (event.key === 'F2') {
                    event.preventDefault()
                    edit(event.currentTarget)
                } else if (event.key === 'Escape') {
                    if (mode === 'ready' && hasNotes && !notesDismissed) {
                        setNotesDismissed(true)
                    } else {
                        revert()
                        setMode('ready')
                    }
                }
            },
        },
    }
}
