import React, { type ComponentProps } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { META_SEPARATORS } from './VisitMeta'

/** The notes written across the visit, in the order you give them. */
export const VisitNotes = ({ className, ...props }: ComponentProps<'ul'>) => (
    <ul
        data-slot="visit-notes"
        className={cn(
            'm-0 flex list-none flex-col gap-2 border-s-2 border-dhis2-border p-0 ps-3 text-sm',
            className
        )}
        {...props}
    />
)

export const VisitNote = ({ className, ...props }: ComponentProps<'li'>) => (
    <li
        data-slot="visit-note"
        className={cn('flex flex-col gap-0.5', className)}
        {...props}
    />
)

/** Who wrote the note and when, with a dot between each child. */
export const VisitNoteMeta = ({
    className,
    ...props
}: ComponentProps<'div'>) => (
    <div
        data-slot="visit-note-meta"
        className={cn(
            'flex flex-wrap items-baseline gap-x-1.5 text-xs text-dhis2-muted-foreground empty:hidden',
            META_SEPARATORS,
            className
        )}
        {...props}
    />
)

/** The note as written, keeping its line breaks. */
export const VisitNoteText = ({ className, ...props }: ComponentProps<'p'>) => (
    <p
        data-slot="visit-note-text"
        className={cn(
            'm-0 whitespace-pre-wrap text-dhis2-foreground wrap-break-word',
            className
        )}
        {...props}
    />
)
