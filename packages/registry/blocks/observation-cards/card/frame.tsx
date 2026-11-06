import { CardTitle } from '@/components/dhis2/ui/card'
import { cn } from '@/components/dhis2/ui/cn'
import {
    IconErrorFilled16,
    IconInfo16,
    IconWarningFilled16,
} from '@dhis2/ui-icons'
import React, { type ComponentPropsWithoutRef, type ReactNode } from 'react'

/**
 * A full-width tinted band at the card's foot, for when and how a value was
 * recorded. A sparkline right above it takes the free space instead, so it
 * sits on the band.
 */
export const FOOTER_BAND =
    '-mx-4 -mb-4 mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-b-dhis2-md border-t border-dhis2-border bg-dhis2-background-subtle px-4 py-2 text-xs text-dhis2-muted-foreground [[data-slot=observation-sparkline]+&]:mt-0'

/** The footer band once the value is out of date: the DHIS2 warning tint. */
export const STALE_BAND =
    'border-dhis2-warning-border bg-dhis2-warning-subtle text-dhis2-warning-strong'

/** The card's name, as a level-3 heading. */
export function CardHeading({
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) {
    return (
        <CardTitle
            role="heading"
            aria-level={3}
            {...props}
            data-slot="observation-label"
            className={cn(
                'min-w-0 text-sm break-words text-dhis2-foreground',
                className
            )}
        />
    )
}

const NOTE_ICONS = {
    info: IconInfo16,
    warning: IconWarningFilled16,
    error: IconErrorFilled16,
}

const NOTE_TONES = {
    info: 'text-dhis2-muted-foreground',
    warning: 'font-medium text-dhis2-warning',
    error: 'font-medium text-dhis2-destructive',
}

/** A short note with an icon, so a warning or failure never rests on colour alone. */
export function CardNote({
    tone,
    children,
}: {
    tone: keyof typeof NOTE_ICONS
    children: ReactNode
}) {
    const Icon = NOTE_ICONS[tone]
    return (
        <span className={cn('inline-flex items-start gap-1', NOTE_TONES[tone])}>
            <span
                aria-hidden="true"
                className="inline-flex h-[1lh] shrink-0 items-center [&_svg]:size-3.5"
            >
                <Icon />
            </span>
            <span>{children}</span>
        </span>
    )
}
