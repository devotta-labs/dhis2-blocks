import type { KeyboardEvent } from 'react'
import type { useDataEngine } from '@dhis2/app-runtime'
import type {
    EditorProblem,
    FileUploads,
    PopupEditor,
    PopupEditorProps,
    PopupValueType,
} from '../index'
import {
    composing,
    createFileUploads,
    editorFor,
    formatCount,
    matchCount,
    popupEditors,
    useAnnounced,
} from '../index'

export type SupportedValueInputTypes = [
    EditorProblem,
    FileUploads,
    PopupEditor,
    PopupEditorProps,
    PopupValueType,
]

// Every export, used as an app would use it.
export const editor: PopupEditor | undefined = editorFor('LONG_TEXT')
export const registered: PopupEditor | undefined = popupEditors.AGE
export const counted: string = `${formatCount(1234)} ${matchCount(5, 50)}`
export const say = (text: string): void => useAnnounced(text)
export const typing = (event: KeyboardEvent): boolean => composing(event)
export const uploadsFor = (
    engine: ReturnType<typeof useDataEngine>,
    key: string
): FileUploads => createFileUploads(engine, new Map(), key)
