import type { CellKey } from './types'

export type Tone = 'error' | 'warning'

export interface CellMessage {
    tone: Tone
    text: string
}

/** What logic says about one cell, whatever produced it. */
export interface CellAnnotations {
    /** Why the cell cannot be edited. */
    readOnly?: string
    /** Why the cell is hidden. */
    hiddenBy?: string
    required: boolean
    messages: ReadonlyArray<CellMessage>
    /** Option codes the cell does not offer. */
    hiddenOptions?: ReadonlySet<string>
}

/** What logic says about each cell; only cells it has something to say about have an entry. */
export interface AnnotationsState {
    cells: Partial<Record<CellKey, CellAnnotations>>
    /** Row id → messages without a cell, shown in the row header. */
    rowMessages: ReadonlyMap<string, ReadonlyArray<CellMessage>>
    /** Row id → notes shown under the row's label. */
    rowNotes: ReadonlyMap<string, ReadonlyArray<string>>
}
