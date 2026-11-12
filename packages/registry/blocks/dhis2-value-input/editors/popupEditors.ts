import type { ReactNode } from 'react'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import type { Politeness } from '@/components/dhis2/ui/announcer'
import { AgeEditor, AgeFormEditor } from './AgeEditor'
import { CoordinateEditor, CoordinateFormEditor } from './CoordinateEditor'
import { FileEditor, FileFormEditor } from './FileEditor'
import type { FileUploads } from './fileUploads'
import { LongTextEditor, LongTextFormEditor } from './LongTextEditor'
import { MultiSelectEditor, MultiSelectFormEditor } from './MultiSelectEditor'

/** The pop-up value types, which a cell edits in a small editor that opens from it, and each one's editor. */
interface Editors<Editor> {
    LONG_TEXT?: Editor
    MULTI_TEXT?: Editor
    AGE?: Editor
    COORDINATE?: Editor
    FILE_RESOURCE?: Editor
    IMAGE?: Editor
}

/** Whether a save was taken: `invalid` is refused, `unchanged` is the stored value, `queued` is accepted. */
type CommitResult = 'invalid' | 'unchanged' | 'queued'

export type PopupValueType = keyof Editors<unknown>

/** Why what an editor holds cannot be saved, and that input as one text the cell can show. */
export interface EditorProblem {
    message: string
    /** The input as it would be typed: `lat, lng` for a coordinate, the date of birth or the parts for an age. */
    text: string
}

/** What an editor takes, in a cell's dialog or in a form. */
interface EditorProps {
    field: Field
    /** The stored value, or undefined for none. */
    value: string | undefined
    settings: ValueSettings
    labelledBy: string
    hiddenOptions?: ReadonlySet<string>
    /** A stored value, or null to clear. The cell or the form commits it, and says whether it took it. */
    save(value: string | null): CommitResult
    /**
     * The value as it would be saved (null clears), or why it cannot be. Call on every change; the cell or the form
     * saves it when focus leaves the editor, and with a problem saves nothing and keeps the problem's text as its draft.
     */
    report(value: string | null, problem?: EditorProblem): void
    /** Says an outcome to screen reader users; the shared announcer by default. */
    announce?(text: string, politeness?: Politeness): void
    /** The stored file's name, for file and image fields; its id is shown without one. */
    fileName?: string
    /** Where the stored file or image can be fetched; without it there is no preview and no "Download". */
    fileUrl?: string
    /** Whether the server cannot be reached now: files cannot be uploaded. */
    offline?: boolean
    /** Where the file editor runs its uploads; its own, stopped when it unmounts, by default. */
    uploads?: FileUploads
}

/** An editor in a cell's dialog, which closes on Save or Cancel. */
export interface PopupEditorProps extends EditorProps {
    /** The cell's own DOM id; editors name their fields with it. */
    cellId?: string
    /** The cell's key, as the provider's `keyOf` gives it. */
    cellKey?: string
    cancel(): void
    /**
     * The text typed to open the editor, for editors that start with a search or text: one key, or several characters
     * composed by an input method or a dead key.
     */
    firstKey?: string
}

/** An editor in a form: always there, with no Save or Cancel, and laid out as a form's fields are. */
export interface FormEditorProps extends EditorProps {
    /** The ids of what describes the field, for an editor whose one control stands for it. */
    describedBy?: string
    /** The field has a problem or an error message, so each of the editor's fields is marked invalid. */
    invalid?: boolean
}

/**
 * A value type's editor, drawn in the cell's dialog. Parts it renders in a portal (house popovers, selects) count as
 * inside the dialog: React carries their events through it.
 */
export type PopupEditor = (props: PopupEditorProps) => ReactNode

/** A value type's editor, drawn in a form. */
export type FormEditor = (props: FormEditorProps) => ReactNode

/** The editors registered; a type without one shows its value read-only. */
export const popupEditors: Editors<PopupEditor> = {
    LONG_TEXT: LongTextEditor,
    MULTI_TEXT: MultiSelectEditor,
    AGE: AgeEditor,
    COORDINATE: CoordinateEditor,
    FILE_RESOURCE: FileEditor,
    IMAGE: FileEditor,
}

/** The editors a form draws; a type without one shows its value read-only. */
export const formEditors: Editors<FormEditor> = {
    LONG_TEXT: LongTextFormEditor,
    MULTI_TEXT: MultiSelectFormEditor,
    AGE: AgeFormEditor,
    COORDINATE: CoordinateFormEditor,
    FILE_RESOURCE: FileFormEditor,
    IMAGE: FileFormEditor,
}

const lookUp = <Editor>(
    editors: Editors<Editor>,
    valueType: string
): Editor | undefined =>
    Object.entries(editors).find(([type]) => type === valueType)?.[1]

/** The editor for a field's value type, which can be any DHIS2 value type. */
export const editorFor = (valueType: string): PopupEditor | undefined =>
    lookUp(popupEditors, valueType)

/** The form's editor for a field's value type, which can be any DHIS2 value type. */
export const formEditorFor = (valueType: string): FormEditor | undefined =>
    lookUp(formEditors, valueType)
