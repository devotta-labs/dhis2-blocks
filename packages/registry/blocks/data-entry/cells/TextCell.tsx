import i18n from '@dhis2/d2-i18n'
import { memo, useState } from 'react'
import {
    cellKind,
    inputModeFor,
    typedText,
} from '@/components/dhis2-value-types'
import { cn } from '@/components/dhis2/ui/cn'
import { useDataEntryContext } from '../provider/context'
import type { CellComponent, ControlProps } from './cellProps'
import { useCellContext } from './CellStatus'
import { READY_CLASS, useCellMode } from './useCellMode'

// Borderless until it has focus, then a box. Invalid looks red only while it does not have focus, so the focus ring
// always shows.
export const CONTROL_CLASS =
    'block h-9 w-full min-w-0 truncate bg-transparent px-2 text-sm text-dhis2-grey-900 outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-dhis2-blue-600)] aria-invalid:not-focus:bg-dhis2-red-050 aria-invalid:not-focus:shadow-[inset_0_0_0_2px_var(--color-dhis2-red-600)]'
export const LOCKED_CLASS = 'bg-dhis2-grey-100 text-dhis2-grey-800'
export const HIDDEN_CLASS = 'bg-dhis2-grey-200 italic'

/**
 * Text, numbers, dates and times in one native input, saved when the person moves on. A cell that cannot be edited
 * is the same input made read-only, so focus survives a rule locking or hiding it.
 */
export const TextCell = memo(function TextCell({
    id,
    cellKey,
    field,
    labelledBy,
    move,
    readOnly,
    hidden = false,
    aria,
}: ControlProps) {
    const { store, settings } = useDataEntryContext()
    const { view } = useCellContext()
    // What has been typed and not yet saved; `null` shows the cell's own text.
    const [draft, setDraft] = useState<string | null>(null)
    const locked = readOnly !== undefined
    const commit = () => {
        if (draft === null) {
            return undefined
        }
        setDraft(null)
        // A rule can lock the cell while its text is being typed: the lock wins. Text in a cell a rule only hid is the
        // person's, saved, then cleared by the rule, which says so; `commit` reads the cell's lock as it saves.
        return locked && !hidden ? undefined : view.commit(draft)
    }
    const revert = () => {
        setDraft(null)
        if (!locked && view.draft !== undefined) {
            store.getState().discardDraft(cellKey)
        }
    }
    const { mode, typed, inputProps } = useCellMode({
        commit,
        revert,
        move,
        readOnly: locked,
    })
    const stored =
        view.value === undefined ? '' : typedText(field, view.value, settings)
    const shown = hidden
        ? i18n.t('Hidden')
        : locked
          ? stored
          : (draft ?? view.draft ?? stored)
    return (
        <input
            {...inputProps}
            {...aria}
            id={id}
            aria-labelledby={labelledBy}
            type="text"
            readOnly={locked}
            inputMode={inputModeFor(field)}
            autoComplete="off"
            spellCheck={false}
            value={shown}
            onChange={(event) => {
                setDraft(event.target.value)
                typed()
            }}
            onBlur={commit}
            className={cn(
                CONTROL_CLASS,
                cellKind(field) === 'number' && 'text-end tabular-nums',
                mode === 'ready' && READY_CLASS,
                locked && LOCKED_CLASS,
                hidden && HIDDEN_CLASS
            )}
        />
    )
}) satisfies CellComponent
