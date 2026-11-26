/** One way of splitting the people counted: age band, sex, origin. A DHIS2 category. */
export interface TallyCategory {
    id: string
    label: string
    options: ReadonlyArray<{ id: string; label: string }>
}

/** What one line of the sheet counts: a dose, a diagnosis. A DHIS2 data element. */
export interface TallyRow {
    id: string
    label: string
    /** The heading the row sits under ("At birth", "6 weeks"); rows that share one are drawn together. */
    group?: string
}

/** The option chosen in each category, by category id: the options of one category option combination. */
export type TallyOptions = Readonly<Record<string, string>>

/** Cells that are never marked, hatched out on paper: the row's cells in every column with these options. */
export interface TallyClosedCell {
    row: string
    options: TallyOptions
}

/** The sheet as it is printed: its rows, the categories that make its columns, and the cells left out. */
export interface TallyLayout {
    rows: readonly TallyRow[]
    categories: readonly TallyCategory[]
    closed?: readonly TallyClosedCell[]
}

interface EntryBase {
    /** Unique across every device that tallies the session; joining two logs keeps one entry per id. */
    id: string
    /** When it was made, as an ISO 8601 instant. Orders the entries of a joined log. */
    at: string
    /** The device or person that made it, when the host says; undo takes back the latest entry of its own. */
    by?: string
    /** Entries made by one action share it and are undone together. */
    batch?: string
}

/**
 * One line of a session's log. A tap adds one to a cell; a correction adds any whole number, less than zero to
 * lower a count; an undo takes back the tap or correction it names. A settle brings a cell that joined logs left
 * below zero back to zero; the sheet writes it before a tap on such a cell, with an id that devices seeing the same
 * log share, so it is counted once. The log only grows, and the counts are the sum of what is left, so two devices'
 * logs join in any order. Two corrections of one cell made apart both apply.
 */
export type TallyEntry =
    | (EntryBase & { kind: 'tap'; row: string; options: TallyOptions })
    | (EntryBase & {
          kind: 'correction'
          row: string
          options: TallyOptions
          delta: number
      })
    | (EntryBase & {
          kind: 'settle'
          row: string
          options: TallyOptions
          delta: number
      })
    | (EntryBase & { kind: 'undo'; undoes: string })

/** One column of the sheet: one option from each category. */
export interface TallyColumn {
    /** The option ids in category order, joined; unique on the sheet. */
    key: string
    options: TallyOptions
    /** The option labels in category order. */
    labels: readonly string[]
}

/** What a cell adds up to. */
export interface TallyCount {
    row: string
    options: TallyOptions
    count: number
}
