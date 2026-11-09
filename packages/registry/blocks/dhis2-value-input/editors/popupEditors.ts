import type { ReactNode } from 'react'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import type { Politeness } from '@/components/dhis2/ui/announcer'
import { AgeEditor } from './AgeEditor'
import { CoordinateEditor } from './CoordinateEditor'
import { FileEditor } from './FileEditor'
import type { FileUploads } from './fileUploads'
import { LongTextEditor } from './LongTextEditor'
import { MultiSelectEditor } from './MultiSelectEditor'

/** The pop-up value types, which a cell edits in a small editor that opens from it, and each one's editor. */
interface PopupEditors {
    LONG_TEXT?: PopupEditor
    MULTI_TEXT?: PopupEditor
    AGE?: PopupEditor
    COORDINATE?: PopupEditor
    FILE_RESOURCE?: PopupEditor
    IMAGE?: PopupEditor
}

/** Whether a save was taken: `invalid` is refused, `unchanged` is the stored value, `queued` is accepted. */
type CommitResult = 'invalid' | 'unchanged' | 'queued'

export type PopupValueType = keyof PopupEditors

/** Why what an editor holds cannot be saved, and that input as one text the cell can show. */
export interface EditorProblem {
    message: string
    /** The input as it would be typed: `lat, lng` for a coordinate, the date of birth or the parts for an age. */
    text: string
}

export interface PopupEditorProps {
    field: Field
    /** The stored value, or undefined for none. */
    value: string | undefined
    settings: ValueSettings
    /** The cell's own DOM id; editors name their fields with it. */
    cellId?: string
    /** The cell's key, as the provider's `keyOf` gives it. */
    cellKey?: string
    labelledBy: string
    hiddenOptions?: ReadonlySet<string>
    /** A stored value, or null to clear. The cell commits it, and says whether it took it. */
    save(value: string | null): CommitResult
    /**
     * The value as it would be saved (null clears), or why it cannot be. Call on every change; the cell saves it when
     * focus leaves the editor, and with a problem saves nothing and keeps the problem's text as its draft.
     */
    report(value: string | null, problem?: EditorProblem): void
    cancel(): void
    /**
     * The text typed to open the editor, for editors that start with a search or text: one key, or several characters
     * composed by an input method or a dead key.
     */
    firstKey?: string
    /** Says an outcome to screen reader users; the shared announcer by default. */
    announce?(text: string, politeness?: Politeness): void
    /** Draws the editor in the page, not in a pop-up. */
    inline?: boolean
    /** The stored file's name, for file and image fields; its id is shown without one. */
    fileName?: string
    /** Where the stored file or image can be fetched; without it there is no preview and no "Download". */
    fileUrl?: string
    /** Whether the server cannot be reached now: files cannot be uploaded. */
    offline?: boolean
    /** Where the file editor runs its uploads; its own, stopped when it unmounts, by default. */
    uploads?: FileUploads
}

/**
 * A value type's editor, drawn in the cell's dialog. Parts it renders in a portal (house popovers, selects) count as
 * inside the dialog: React carries their events through it.
 */
export type PopupEditor = (props: PopupEditorProps) => ReactNode

/** The editors registered; a type without one shows its value read-only. */
export const popupEditors: PopupEditors = {
    LONG_TEXT: LongTextEditor,
    MULTI_TEXT: MultiSelectEditor,
    AGE: AgeEditor,
    COORDINATE: CoordinateEditor,
    FILE_RESOURCE: FileEditor,
    IMAGE: FileEditor,
}

/** The editor for a field's value type, which can be any DHIS2 value type. */
export const editorFor = (valueType: string): PopupEditor | undefined =>
    Object.entries(popupEditors).find(([type]) => type === valueType)?.[1]
