import i18n from '@dhis2/d2-i18n'
import {
    IconBlock16,
    IconCalendar16,
    IconCheckmarkCircle16,
    IconEdit16,
    IconWarningFilled16,
} from '@dhis2/ui-icons'
import { cva } from 'class-variance-authority'
import React, {
    useContext,
    type ComponentProps,
    type ComponentPropsWithoutRef,
    type ComponentType,
} from 'react'
import { Badge } from '@/components/dhis2/ui/badge'
import { cn } from '@/components/dhis2/ui/cn'
import { InVisitServices } from './context'

export type VisitStatusVariant =
    | 'completed'
    | 'in-progress'
    | 'scheduled'
    | 'overdue'
    | 'skipped'

const ICONS = {
    completed: IconCheckmarkCircle16,
    'in-progress': IconEdit16,
    scheduled: IconCalendar16,
    overdue: IconWarningFilled16,
    skipped: IconBlock16,
} satisfies Record<VisitStatusVariant, ComponentType>

const statusLabel = (status: VisitStatusVariant) => {
    switch (status) {
        case 'completed':
            return i18n.t('Completed')
        case 'in-progress':
            return i18n.t('In progress')
        case 'scheduled':
            return i18n.t('Scheduled')
        case 'overdue':
            return i18n.t('Overdue')
        case 'skipped':
            return i18n.t('Skipped')
    }
}

const StatusIcon = ({
    status,
    slot,
    className,
}: {
    status: VisitStatusVariant
    slot: string
    className?: string
}) => {
    const Icon = ICONS[status]
    return (
        <span
            aria-hidden="true"
            data-slot={slot}
            className={cn('flex shrink-0 [&>svg]:size-3.5', className)}
        >
            <Icon />
        </span>
    )
}

/** A status chip: each role's strong text on its fill, outlined in forced colours. */
export const visitStatusVariants = cva(
    'h-auto min-h-5 gap-1 py-0.5 ps-1.5 pe-2 forced-colors:border-[CanvasText]',
    {
        variants: {
            variant: {
                completed: 'bg-dhis2-success-fill text-dhis2-success-strong',
                'in-progress': 'bg-dhis2-info-fill text-dhis2-info-strong',
                scheduled: 'bg-dhis2-neutral-fill text-dhis2-neutral-strong',
                overdue:
                    'bg-dhis2-destructive-fill text-dhis2-destructive-strong',
                skipped: 'bg-dhis2-neutral-fill text-dhis2-neutral-strong',
            },
        },
    }
)

export interface VisitStatusProps extends ComponentPropsWithoutRef<'span'> {
    variant: VisitStatusVariant
}

/**
 * A visit's status as a badge: an icon and words, never colour alone. The
 * words are your children, or the status's localized name without them.
 */
export const VisitStatus = ({
    variant,
    className,
    children,
    ...props
}: VisitStatusProps) => (
    <Badge
        data-slot="visit-status"
        data-status={variant}
        className={cn(visitStatusVariants({ variant }), className)}
        {...props}
    >
        <StatusIcon status={variant} slot="visit-status-icon" />
        <span>{children ?? statusLabel(variant)}</span>
    </Badge>
)

/** The services done in a visit, such as Vaccination or Growth monitoring, as a wrapping list. */
export const VisitServices = ({
    className,
    ...props
}: ComponentProps<'ul'>) => (
    <InVisitServices.Provider value>
        <ul
            // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops the list role of a list without markers; VoiceOver needs it to move by list
            role="list"
            data-slot="visit-services"
            className={cn(
                'm-0 flex list-none flex-wrap items-center gap-1.5 p-0',
                className
            )}
            {...props}
        />
    </InVisitServices.Provider>
)

const SERVICE_ICON = {
    completed: 'text-dhis2-success-indicator',
    'in-progress': 'text-dhis2-info-indicator',
    scheduled: 'text-dhis2-neutral-indicator',
    overdue: 'text-dhis2-destructive-indicator',
    skipped: 'text-dhis2-neutral-indicator',
} satisfies Record<VisitStatusVariant, string>

const SERVICE_CLASS =
    'inline-flex min-h-6 items-center gap-1 rounded-dhis2-sm border border-dhis2-border bg-dhis2-background px-2 py-0.5 text-xs leading-4 text-dhis2-foreground data-[status=skipped]:text-dhis2-muted-foreground'

export interface VisitServiceProps extends ComponentProps<'span'> {
    /** How far this service got, when a visit was partly done: shown with an icon and words. */
    status?: VisitStatusVariant
}

/**
 * One service in a visit, as a compact chip. A list item inside
 * `VisitServices`; a plain span anywhere else, such as a table cell.
 */
export const VisitService = ({
    status,
    className,
    children,
    ...props
}: VisitServiceProps) => {
    const inList = useContext(InVisitServices)
    const chip = (
        <span
            data-slot="visit-service"
            data-status={status}
            className={cn(SERVICE_CLASS, className)}
            {...props}
        >
            {status === undefined ? null : (
                <StatusIcon
                    status={status}
                    slot="visit-service-icon"
                    className={SERVICE_ICON[status]}
                />
            )}
            <span className="font-medium">{children}</span>
            {status === undefined ? null : (
                <span
                    data-slot="visit-service-status"
                    className="text-dhis2-muted-foreground before:pe-1 before:content-['·']"
                >
                    {statusLabel(status)}
                </span>
            )}
        </span>
    )
    return inList ? <li className="flex">{chip}</li> : chip
}
