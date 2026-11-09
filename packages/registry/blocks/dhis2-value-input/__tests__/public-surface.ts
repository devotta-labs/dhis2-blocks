import type {
    EditorProblem,
    PopupEditor,
    PopupEditorProps,
    PopupValueType,
} from '../index'
import {
    editorFor,
    formatCount,
    matchCount,
    popupEditors,
    useAnnounced,
} from '../index'

export type SupportedValueInputTypes = [
    EditorProblem,
    PopupEditor,
    PopupEditorProps,
    PopupValueType,
]

// Every export, used as an app would use it.
export const editor: PopupEditor | undefined = editorFor('LONG_TEXT')
export const registered: PopupEditor | undefined = popupEditors.AGE
export const counted: string = `${formatCount(1234)} ${matchCount(5, 50)}`
export const say = (text: string): void => useAnnounced(text)
