import type { ReactNode } from 'react'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import type { CellKey, CommitResult } from '../model/types'
import { AgeEditor } from './editors/AgeEditor'
import { CoordinateEditor } from './editors/CoordinateEditor'
import { FileEditor } from './editors/FileEditor'
import { LongTextEditor } from './editors/LongTextEditor'
import { MultiSelectEditor } from './editors/MultiSelectEditor'
import { OrgUnitEditor } from './editors/OrgUnitEditor'
import { UsernameEditor } from './editors/UsernameEditor'

/** The pop-up value types, which a cell edits in a small editor that opens from it, and each one's editor. */
interface PopupEditors {
    LONG_TEXT?: PopupEditor
    MULTI_TEXT?: PopupEditor
    AGE?: PopupEditor
    COORDINATE?: PopupEditor
    ORGANISATION_UNIT?: PopupEditor
    USERNAME?: PopupEditor
    FILE_RESOURCE?: PopupEditor
    IMAGE?: PopupEditor
}

export type PopupValueType = keyof PopupEditors

export interface PopupEditorProps {
    field: Field
    /** The stored value, or undefined for none. */
    value: string | undefined
    settings: ValueSettings
    /** The cell's own DOM id; editors name their fields with it. */
    cellId: string
    /** The cell's key: its row and column, an event and a data element in a form of events. */
    cellKey: CellKey
    labelledBy: string
    hiddenOptions?: ReadonlySet<string>
    /** A stored value, or null to clear. The cell commits it, and says whether it took it. */
    save(value: string | null): CommitResult
    /** The value as it would be saved (null clears), or why it cannot be. Call on every change; the cell saves it when focus leaves the editor, and with a problem saves nothing and announces it. */
    report(value: string | null, problem?: string): void
    cancel(): void
    /**
     * The text typed to open the editor, for editors that start with a search or text: one key, or several characters
     * composed by an input method or a dead key.
     */
    firstKey?: string
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
    ORGANISATION_UNIT: OrgUnitEditor,
    USERNAME: UsernameEditor,
    FILE_RESOURCE: FileEditor,
    IMAGE: FileEditor,
}

/** Value types whose typed text parses, so paste can fill them. */
export const pasteablePopupTypes: ReadonlySet<PopupValueType> = new Set([
    'LONG_TEXT',
    'MULTI_TEXT',
    'AGE',
    'COORDINATE',
    'ORGANISATION_UNIT',
    'USERNAME',
])

/** The editor for a field's value type, which can be any DHIS2 value type. */
export const editorFor = (valueType: string): PopupEditor | undefined =>
    Object.entries(popupEditors).find(([type]) => type === valueType)?.[1]
