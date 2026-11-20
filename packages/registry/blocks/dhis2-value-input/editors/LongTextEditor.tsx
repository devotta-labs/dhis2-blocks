import i18n from '@dhis2/d2-i18n'
import { useEffect, useId, useRef, useState } from 'react'
import { parseTyped } from '@/components/dhis2-value-types'
import { Textarea } from '@/components/dhis2/ui/textarea'
import type { FormEditorProps, PopupEditorProps } from './popupEditors'
import { EditorButtons, idList, saveOnCtrlEnter } from './EditorButtons'

const useLongText = ({
    field,
    value,
    settings,
    firstKey,
    save,
    report,
}: Pick<
    PopupEditorProps,
    'field' | 'value' | 'settings' | 'firstKey' | 'save' | 'report'
>) => {
    const [text, setText] = useState(firstKey ?? value ?? '')
    const [problem, setProblem] = useState<string>()
    const area = useRef<HTMLTextAreaElement>(null)

    const tell = (next: string) => {
        const parsed = parseTyped(field, next, settings)
        if (parsed.ok) {
            report(parsed.value ?? null)
        } else {
            report(null, { message: parsed.problem.message, text: next })
        }
    }
    return {
        text,
        problem,
        area,
        tell,
        change: (next: string) => {
            setText(next)
            setProblem(undefined)
            tell(next)
        },
        commit: () => {
            const parsed = parseTyped(field, text, settings)
            if (parsed.ok) {
                save(parsed.value ?? null)
            } else {
                setProblem(parsed.problem.message)
                area.current?.focus()
            }
        },
    }
}

const LongTextBox = ({
    editor: { text, problem, area, change, commit },
    labelledBy,
    describedBy,
    invalid = false,
}: {
    editor: ReturnType<typeof useLongText>
    labelledBy: string
    describedBy?: string
    invalid?: boolean
}) => {
    const problemId = useId()
    return (
        <>
            <Textarea
                ref={area}
                value={text}
                dir="auto"
                aria-labelledby={labelledBy}
                aria-describedby={idList(
                    problem !== undefined && problemId,
                    describedBy
                )}
                aria-invalid={
                    invalid || problem !== undefined ? true : undefined
                }
                onChange={({ target }) => change(target.value)}
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
        </>
    )
}

/**
 * Long text in a text area: Enter adds a line, Ctrl+Enter or ⌘+Enter saves. It opens on the stored text with the
 * cursor at the end, or on the text typed to open it. A field mask is checked when the text is saved, and a text it
 * refuses keeps the editor open with the message.
 */
export const LongTextEditor = (props: PopupEditorProps) => {
    const editor = useLongText(props)
    const hintId = useId()
    useEffect(() => {
        const box = editor.area.current
        box?.focus()
        box?.setSelectionRange(editor.text.length, editor.text.length)
        if (props.firstKey !== undefined) {
            editor.tell(editor.text)
        }
    }, [])
    return (
        <>
            <LongTextBox
                editor={editor}
                labelledBy={props.labelledBy}
                describedBy={hintId}
            />
            <p id={hintId} className="text-xs text-dhis2-muted-foreground">
                {i18n.t('Ctrl+Enter or ⌘+Enter saves')}
            </p>
            <EditorButtons save={editor.commit} cancel={props.cancel} />
        </>
    )
}

/** Long text in a form: the text area alone, waiting to be focused. */
export const LongTextFormEditor = (props: FormEditorProps) => {
    const editor = useLongText(props)
    return (
        <LongTextBox
            editor={editor}
            labelledBy={props.labelledBy}
            describedBy={props.describedBy}
            invalid={props.invalid}
        />
    )
}
