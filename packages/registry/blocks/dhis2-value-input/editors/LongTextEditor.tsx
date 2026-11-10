import i18n from '@dhis2/d2-i18n'
import { useEffect, useId, useRef, useState } from 'react'
import { parseTyped } from '@/components/dhis2-value-types'
import { Textarea } from '@/components/dhis2/ui/textarea'
import type { PopupEditorProps } from './popupEditors'
import { EditorButtons, idList, saveOnCtrlEnter } from './EditorButtons'

/**
 * Long text in a text area: Enter adds a line, Ctrl+Enter or ⌘+Enter saves. It opens on the stored text with the
 * cursor at the end, or on the text typed to open it. A field mask is checked when the text is saved, and a text it
 * refuses keeps the editor open with the message.
 */
export const LongTextEditor = ({
    field,
    value,
    settings,
    labelledBy,
    describedBy,
    invalid = false,
    firstKey,
    inline = false,
    save,
    report,
    cancel,
}: PopupEditorProps) => {
    const [text, setText] = useState(firstKey ?? value ?? '')
    // Said on a save the field mask refused, until the text changes.
    const [problem, setProblem] = useState<string>()
    const area = useRef<HTMLTextAreaElement>(null)
    const hintId = useId()
    const problemId = useId()

    const tell = (next: string) => {
        const parsed = parseTyped(field, next, settings)
        if (parsed.ok) {
            report(parsed.value ?? null)
        } else {
            report(null, { message: parsed.problem.message, text: next })
        }
    }
    useEffect(() => {
        // In a form the field waits to be focused.
        if (inline) {
            return
        }
        const box = area.current
        box?.focus()
        box?.setSelectionRange(text.length, text.length)
        // The text that opened the editor is already a change.
        if (firstKey !== undefined) {
            tell(text)
        }
    }, [])

    const commit = () => {
        const parsed = parseTyped(field, text, settings)
        if (parsed.ok) {
            save(parsed.value ?? null)
        } else {
            setProblem(parsed.problem.message)
            // Back to the text, where the message is about, whether Save was clicked or Ctrl+Enter pressed.
            area.current?.focus()
        }
    }
    return (
        <>
            <Textarea
                ref={area}
                value={text}
                aria-labelledby={labelledBy}
                aria-describedby={idList(
                    problem !== undefined && problemId,
                    !inline && hintId,
                    describedBy
                )}
                aria-invalid={
                    invalid || problem !== undefined ? true : undefined
                }
                onChange={({ target }) => {
                    setText(target.value)
                    setProblem(undefined)
                    tell(target.value)
                }}
                onKeyDown={saveOnCtrlEnter(commit)}
                className="max-h-60 min-h-24"
            />
            {problem === undefined ? null : (
                <p
                    id={problemId}
                    role="alert"
                    className="text-xs text-dhis2-destructive"
                >
                    {problem}
                </p>
            )}
            {inline ? null : (
                <p id={hintId} className="text-xs text-dhis2-muted-foreground">
                    {i18n.t('Ctrl+Enter or ⌘+Enter saves')}
                </p>
            )}
            <EditorButtons save={commit} cancel={cancel} inline={inline} />
        </>
    )
}
