import i18n from '@dhis2/d2-i18n'
import { cn } from '@/components/dhis2/ui/cn'
import { Input } from '@/components/dhis2/ui/input'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useDataTableInstance } from './tableHook'

// TanStack types the global filter loosely; anything but text reads as no search.
const searchText = z.string().catch('')

export interface DataTableSearchProps {
    className?: string
    /** Default: "Search". Also the accessible name. */
    placeholder?: string
    /** Milliseconds before the typed text is applied. Default 300. */
    debounce?: number
}

/** A search input bound to the table's global filter. */
export const DataTableSearch = ({
    className,
    placeholder,
    debounce = 300,
}: DataTableSearchProps) => {
    const table = useDataTableInstance()
    const current = searchText.parse(table.state.globalFilter)
    const [text, setText] = useState(current)
    // The last text this input applied, to tell outside changes from our own.
    const applied = useRef(current)
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(() => {
        if (current === applied.current) return
        applied.current = current
        clearTimeout(timer.current)
        setText(current)
    }, [current])

    useEffect(() => () => clearTimeout(timer.current), [])

    const apply = (next: string) => {
        clearTimeout(timer.current)
        applied.current = next
        table.setGlobalFilter(next)
    }

    const name = placeholder ?? i18n.t('Search')
    return (
        <Input
            type="search"
            data-slot="data-table-search"
            aria-label={name}
            placeholder={name}
            value={text}
            className={cn('w-56 max-w-full', className)}
            onChange={(event) => {
                const next = event.currentTarget.value
                setText(next)
                if (next === '') {
                    apply(next)
                    return
                }
                clearTimeout(timer.current)
                timer.current = setTimeout(() => apply(next), debounce)
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter') apply(event.currentTarget.value)
            }}
        />
    )
}
