import { createElement } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { useDataEngine } from '@dhis2/app-runtime'
import type {
    EditorProblem,
    FileUploads,
    Found,
    PopupEditor,
    PopupEditorProps,
    PopupValueType,
    ServerSearch,
    ValueInputProps,
} from '../index'
import {
    composing,
    editedElsewhere,
    createFileUploads,
    editorFor,
    formatCount,
    matchCount,
    MIN_LENGTH,
    popupEditors,
    searchFor,
    useAnnounced,
    useServerSearch,
    ValueInput,
} from '../index'

export type SupportedValueInputTypes = [
    EditorProblem,
    FileUploads,
    Found,
    PopupEditor,
    PopupEditorProps,
    PopupValueType,
    ServerSearch,
    ValueInputProps,
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
export const searched: ServerSearch | undefined = searchFor('USERNAME')
export const found = (search: ServerSearch | undefined): Found | undefined =>
    useServerSearch(search?.search, 'a'.repeat(MIN_LENGTH))
export const reason: string = editedElsewhere()
export const control = (props: ValueInputProps): ReactNode =>
    createElement(ValueInput, props)
