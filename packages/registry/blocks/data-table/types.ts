export type DataTableDensity = 'compact' | 'normal' | 'comfortable'
export type DataTableLayout = 'auto' | 'fixed'
export type DataTableStatus = 'loading' | 'updating' | 'error' | 'ready'
export type DataTableMode = 'client' | 'server'

export interface DataTableColumnMeta {
    /** Header and cell alignment. Default 'start'. */
    align?: 'start' | 'center' | 'end'
    /** Plain-text column name for menus, column settings and CSV, when `header` is not a string. */
    label?: string
    /** Keep cell text on one line. */
    nowrap?: boolean
}
