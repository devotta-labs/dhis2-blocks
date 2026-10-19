'use client'

import * as React from 'react'
import { cn } from './cn'

/*
 * shadcn Table restyled to match @dhis2/ui DataTable: a bordered table with
 * a grey-200 header row, 14px/12px body cells on white, and grey-100 / grey-200
 * row hover / press states.
 *
 * Unlike shadcn, cells wrap by default (as DataTable's do); add
 * `whitespace-nowrap` where a column must stay on one line.
 */

function Table({ className, ...props }: React.ComponentProps<'table'>) {
    return (
        <div
            data-slot="table-container"
            className="relative w-full overflow-x-auto"
        >
            <table
                data-slot="table"
                className={cn(
                    'w-full border-separate border-spacing-0 border border-grey-300 text-sm',
                    className
                )}
                {...props}
            />
        </div>
    )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
    return (
        <thead data-slot="table-header" className={cn(className)} {...props} />
    )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
    return (
        <tbody
            data-slot="table-body"
            className={cn(
                'relative [&>tr:last-child>td]:border-b-transparent',
                className
            )}
            {...props}
        />
    )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
    return (
        <tfoot
            data-slot="table-footer"
            className={cn('[&>tr:first-child>td]:border-t', className)}
            {...props}
        />
    )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
    return (
        <tr
            data-slot="table-row"
            className={cn(
                'group/table-row data-[state=selected]:*:bg-teal-100',
                className
            )}
            {...props}
        />
    )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
    return (
        <th
            data-slot="table-head"
            className={cn(
                'border-b border-grey-300 bg-grey-200 px-3 py-2 text-left align-top text-[13px] font-normal text-grey-800 last:border-e',
                className
            )}
            {...props}
        />
    )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
    return (
        <td
            data-slot="table-cell"
            className={cn(
                'border-b border-grey-300 bg-white px-3 py-3.5 align-middle text-sm text-grey-900 group-hover/table-row:bg-grey-100 group-active/table-row:bg-grey-200',
                className
            )}
            {...props}
        />
    )
}

function TableCaption({
    className,
    ...props
}: React.ComponentProps<'caption'>) {
    return (
        <caption
            data-slot="table-caption"
            className={cn('mt-4 text-sm text-grey-700', className)}
            {...props}
        />
    )
}

export {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
}
