import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/registry/dhis2/ui/card'
import { cn } from '@/registry/dhis2/ui/cn'
import { Skeleton } from '@/registry/dhis2/ui/skeleton'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/registry/dhis2/ui/tooltip'
import i18n from '@dhis2/d2-i18n'
import {
    IconErrorFilled16,
    IconInfo16,
    IconWarningFilled16,
} from '@dhis2/ui-icons'
import React, { useId } from 'react'

const NOTE_ICONS = {
    info: IconInfo16,
    warning: IconWarningFilled16,
    error: IconErrorFilled16,
}

const NOTE_TONES = {
    info: 'text-dhis2-grey-700',
    warning: 'font-medium text-dhis2-yellow-800',
    error: 'font-medium text-dhis2-destructive',
}

/** A full-width tinted band under the body, for when and how a value was recorded. */
const FOOTER =
    'flex-wrap justify-between gap-x-3 gap-y-1 rounded-b-dhis2-md border-t border-dhis2-grey-300 bg-dhis2-grey-050 py-2 text-xs text-dhis2-grey-700'

interface CardNoteProps {
    tone: keyof typeof NOTE_ICONS
    children: React.ReactNode
    'data-slot'?: string
}

/** A short note with an icon, so a warning or failure never rests on colour alone. */
function CardNote({ tone, children, 'data-slot': dataSlot }: CardNoteProps) {
    const Icon = NOTE_ICONS[tone]
    return (
        <span
            data-slot={dataSlot}
            className={cn('inline-flex items-start gap-1', NOTE_TONES[tone])}
        >
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

/**
 * The note shown when the user can't read some stages that capture the value:
 * "Restricted access", with the full reason on hover or focus. A screen reader
 * hears the full reason instead.
 */
export const PartialNote = () => {
    const reason = i18n.t('Some visits are hidden by your access')
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <span
                        tabIndex={0}
                        data-slot="partial-note"
                        className="ms-auto cursor-default rounded-dhis2-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-dhis2-primary"
                    />
                }
            >
                <span aria-hidden="true">
                    <CardNote tone="info">
                        {i18n.t('Restricted access')}
                    </CardNote>
                </span>
                <span className="sr-only">{reason}</span>
            </TooltipTrigger>
            <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
    )
}

export interface ObservationCardFrameProps {
    /** Names the card. While pending without one, a skeleton stands in for it. */
    label?: React.ReactNode
    /** Shown beside the label, such as a legend badge. */
    badge?: React.ReactNode
    /**
     * What the body shows: the children, a loading skeleton, a failure notice,
     * or the "never recorded" notice.
     */
    state?: 'content' | 'pending' | 'error' | 'empty'
    /** A note under the body. */
    footer?: React.ReactNode
    /**
     * `stale` marks a reading that is out of date: the body is greyed. The
     * card's own footer carries the warning note.
     */
    tone?: 'default' | 'stale'
    /**
     * The shape the loading skeleton takes, so a card keeps roughly its loaded
     * height: `trend` adds the change line and the sparkline.
     */
    skeleton?: 'latest' | 'trend'
    className?: string
    children?: React.ReactNode
}

/** The shell shared by the observation cards: label row, body and footer note. */
export function ObservationCardFrame({
    label,
    badge,
    state = 'content',
    footer,
    tone = 'default',
    skeleton = 'latest',
    className,
    children,
}: ObservationCardFrameProps) {
    const titleId = useId()
    const hasLabel = label !== undefined && label !== null && label !== ''
    const pending = state === 'pending'

    return (
        <Card
            role="group"
            aria-labelledby={hasLabel ? titleId : undefined}
            aria-busy={pending || undefined}
            data-tone={tone}
            className={cn(
                'min-w-0 border border-dhis2-grey-400 shadow-none',
                (pending || footer) && 'pb-0',
                className
            )}
        >
            <CardHeader className="flex-row items-center justify-between gap-2">
                {hasLabel ? (
                    <CardTitle
                        id={titleId}
                        role="heading"
                        aria-level={3}
                        className="min-w-0 text-sm text-dhis2-grey-900"
                    >
                        {label}
                    </CardTitle>
                ) : pending ? (
                    <Skeleton className="h-4 w-24" />
                ) : null}
                {badge}
            </CardHeader>
            <CardContent
                className={cn(
                    'flex min-w-0 flex-col gap-2',
                    tone === 'stale' && 'text-dhis2-grey-600'
                )}
            >
                {pending ? (
                    <>
                        <span className="sr-only">{i18n.t('Loading')}</span>
                        <Skeleton className="h-7 w-24" />
                        {skeleton === 'trend' ? (
                            <>
                                <Skeleton className="my-0.5 h-4 w-40" />
                                <Skeleton className="h-10 w-full" />
                            </>
                        ) : null}
                    </>
                ) : state === 'error' ? (
                    <p className="text-sm">
                        <CardNote tone="error">
                            {i18n.t("Couldn't load this value")}
                        </CardNote>
                    </p>
                ) : state === 'empty' ? (
                    <p className="text-sm text-dhis2-grey-700">
                        {i18n.t('Never recorded')}
                    </p>
                ) : (
                    children
                )}
            </CardContent>
            {pending ? (
                <CardFooter className={FOOTER}>
                    <Skeleton className="my-0.5 h-3 w-36" />
                </CardFooter>
            ) : footer ? (
                <CardFooter className={FOOTER}>{footer}</CardFooter>
            ) : null}
        </Card>
    )
}
