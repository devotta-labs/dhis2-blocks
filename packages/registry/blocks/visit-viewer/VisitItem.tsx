import i18n from '@dhis2/d2-i18n'
import { IconChevronRight16 } from '@dhis2/ui-icons'
import React, { type ComponentProps } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/dhis2/ui/collapsible'
import type { VisitStatusVariant } from './VisitStatus'

type CollapsibleProps = ComponentProps<typeof Collapsible>

/** A part's props with a plain class, as shadcn takes it: not Base UI's function of state. */
type PlainClass<Props> = Omit<Props, 'className'> & { className?: string }

/** An ordered list of visits, in the order you sorted them. */
export const VisitList = ({ className, ...props }: ComponentProps<'ol'>) => (
    <ol
        data-slot="visit-list"
        className={cn('m-0 flex list-none flex-col gap-2 p-0', className)}
        {...props}
    />
)

export interface VisitItemProps extends Omit<ComponentProps<'li'>, 'onToggle'> {
    /** The visit's status, as `data-status` for styling: a skipped visit is muted. */
    status?: VisitStatusVariant
    /** Whether its details are open; pass with `onOpenChange` to control it. */
    open?: boolean
    /** Whether its details start open, when you leave it uncontrolled. */
    defaultOpen?: boolean
    onOpenChange?: CollapsibleProps['onOpenChange']
    /** Stops `VisitItemTrigger` from opening or closing the details. */
    disabled?: boolean
}

/**
 * One visit as a card in a `VisitList`. Its details open and close with
 * `VisitItemTrigger` and `VisitItemContent`, uncontrolled by default.
 */
export const VisitItem = ({
    status,
    open,
    defaultOpen,
    onOpenChange,
    disabled,
    className,
    ...props
}: VisitItemProps) => (
    <Collapsible
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        disabled={disabled}
        render={
            <li
                data-slot="visit-item"
                data-status={status}
                className={cn(
                    'group/visit-item flex min-w-0 flex-col gap-2 rounded-dhis2-md border border-dhis2-border bg-dhis2-card px-4 py-3 text-sm text-dhis2-card-foreground',
                    className
                )}
                {...props}
            />
        }
    />
)

/** The card's top row: title, date and status at the start, actions at the end. */
export const VisitItemHeader = ({
    className,
    ...props
}: ComponentProps<'div'>) => (
    <div
        data-slot="visit-item-header"
        className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}
        {...props}
    />
)

const TITLES = {
    2: 'h2',
    3: 'h3',
    4: 'h4',
    5: 'h5',
    6: 'h6',
} as const

/** The visit's name. A level 4 heading unless you pass `level`. */
export const VisitItemTitle = ({
    className,
    level = 4,
    ...props
}: ComponentProps<'h4'> & { level?: keyof typeof TITLES }) => {
    const Title = TITLES[level]
    return (
        <Title
            data-slot="visit-item-title"
            className={cn(
                'm-0 text-sm leading-snug font-medium text-dhis2-foreground group-data-[status=skipped]/visit-item:font-normal group-data-[status=skipped]/visit-item:text-dhis2-muted-foreground',
                className
            )}
            {...props}
        />
    )
}

/** What shows of the visit while its details are closed. */
export const VisitItemBody = ({
    className,
    ...props
}: ComponentProps<'div'>) => (
    <div
        data-slot="visit-item-body"
        className={cn('flex min-w-0 flex-col gap-2', className)}
        {...props}
    />
)

/** Your buttons or links for one visit, such as Open; also a table cell's actions. */
export const VisitItemActions = ({
    className,
    ...props
}: ComponentProps<'div'>) => (
    <div
        data-slot="visit-item-actions"
        className={cn(
            'flex flex-wrap items-center gap-2 in-data-[slot=visit-item-header]:ms-auto',
            className
        )}
        {...props}
    />
)

/**
 * The button that opens and closes the visit's details, with a chevron that
 * turns when they're open. Its text is your children, "Details" without them.
 */
export const VisitItemTrigger = ({
    className,
    children,
    ...props
}: PlainClass<ComponentProps<typeof CollapsibleTrigger>>) => (
    <CollapsibleTrigger
        data-slot="visit-item-trigger"
        className={cn(
            'group/visit-trigger inline-flex min-h-6 min-w-6 cursor-pointer items-center gap-1 rounded-dhis2-sm border-0 bg-transparent px-1.5 py-0.5 text-sm text-dhis2-foreground hover:bg-dhis2-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-dhis2-ring focus-visible:outline-solid disabled:cursor-not-allowed disabled:text-dhis2-disabled-foreground disabled:hover:bg-transparent',
            className
        )}
        {...props}
    >
        <span
            aria-hidden="true"
            data-slot="visit-item-chevron"
            className="flex text-dhis2-muted-foreground transition-transform duration-100 group-data-panel-open/visit-trigger:rotate-90 motion-reduce:transition-none rtl:-scale-x-100 rtl:group-data-panel-open/visit-trigger:-rotate-90"
        >
            <IconChevronRight16 />
        </span>
        {children ?? i18n.t('Details')}
    </CollapsibleTrigger>
)

/** The visit's details, shown while `VisitItemTrigger` has them open. */
export const VisitItemContent = ({
    className,
    ...props
}: PlainClass<ComponentProps<typeof CollapsibleContent>>) => (
    <CollapsibleContent
        data-slot="visit-item-content"
        className={cn(
            'flex min-w-0 flex-col gap-3 border-t border-dhis2-border pt-3',
            className
        )}
        {...props}
    />
)
