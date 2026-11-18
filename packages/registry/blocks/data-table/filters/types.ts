import type { ComponentType } from 'react'

export type DataTableTextOperator =
    | 'contains'
    | 'equals'
    | 'startsWith'
    | 'empty'
    | 'notEmpty'

/** What a filter stores in TanStack `columnFilters[].value`. Serialisable. */
export type DataTableFilterValue =
    | { kind: 'text'; operator: DataTableTextOperator; text: string }
    | { kind: 'number'; min?: number; max?: number }
    /** Inclusive ISO `yyyy-mm-dd` bounds. */
    | { kind: 'date'; from?: string; to?: string }
    | { kind: 'options'; values: readonly string[] }
    | { kind: 'boolean'; value: boolean }
    /** A custom control encodes its own value as a string. */
    | { kind: 'custom'; value: string }

export interface DataTableFilterOption {
    value: string
    label: string
}

interface DataTableFilterBase {
    /** The `columnFilters` id. In client mode it must be a column id. */
    id: string
    label: string
    /** Always show the chip, even with no value. Default false: offered under "Filter". */
    pinned?: boolean
}

export interface DataTableTextFilter extends DataTableFilterBase {
    kind: 'text'
    /** Default `['contains']`. With more than one, the control shows a "Match" select. */
    operators?: readonly DataTableTextOperator[]
    placeholder?: string
}
export interface DataTableNumberFilter extends DataTableFilterBase {
    kind: 'number'
    min?: number
    max?: number
    step?: number
}
export interface DataTableDateFilter extends DataTableFilterBase {
    kind: 'date'
}
export interface DataTableOptionsFilter extends DataTableFilterBase {
    kind: 'options'
    options: readonly DataTableFilterOption[]
    /** Default false: one value. */
    multiple?: boolean
}
export interface DataTableBooleanFilter extends DataTableFilterBase {
    kind: 'boolean'
    /** Defaults: "Yes" / "No". */
    trueLabel?: string
    falseLabel?: string
}
export interface DataTableCustomFilterControlProps {
    filter: DataTableCustomFilter
    /** The encoded value, or undefined when the filter is not set. */
    value: string | undefined
    /** Apply a value, or undefined to clear the filter. Closes the popover. */
    onChange: (value: string | undefined) => void
}
export interface DataTableCustomFilter extends DataTableFilterBase {
    kind: 'custom'
    Control: ComponentType<DataTableCustomFilterControlProps>
    /** Chip text for an encoded value. */
    summarize: (value: string) => string
}

export type DataTableFilter =
    | DataTableTextFilter
    | DataTableNumberFilter
    | DataTableDateFilter
    | DataTableOptionsFilter
    | DataTableBooleanFilter
    | DataTableCustomFilter
