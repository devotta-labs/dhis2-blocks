import { createElement } from 'react'
import type { KeyboardEvent } from 'react'
import type { useDataEngine } from '@dhis2/app-runtime'
import type {
    EditorProblem,
    FileUploads,
    Found,
    PopupEditor,
    PopupEditorProps,
    PopupValueType,
    ValueInputProps,
} from '../index'
import {
    composing,
    dateFormatHint,
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
    ValueInputProps,
]

export const editor: PopupEditor | undefined = editorFor('LONG_TEXT')
export const registered: PopupEditor | undefined = popupEditors.AGE
export const counted: string = `${formatCount(1234)} ${matchCount(5, 50)}`
export const say = (text: string) => useAnnounced(text)
export const typing = (event: KeyboardEvent) => composing(event)
export const uploadsFor = (
    engine: ReturnType<typeof useDataEngine>,
    key: string
) => createFileUploads(engine, new Map(), key)
export const searched = searchFor('USERNAME')
export const found = (search: typeof searched) =>
    useServerSearch(search?.search, 'a'.repeat(MIN_LENGTH))
export const reason: string = editedElsewhere()
export const hint: string = dateFormatHint('date', {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
})
export const control = (props: ValueInputProps) =>
    createElement(ValueInput, props)
