import i18n from '@dhis2/d2-i18n'
import React, { useContext, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { InVisitFact } from './context'

export type VisitFactState =
    | 'value'
    | 'missing'
    | 'not-performed'
    | 'restricted'

/** Clinical values picked from across the visit's stages, as a definition list. */
export const VisitFacts = ({ className, ...props }: ComponentProps<'dl'>) => (
    <dl
        data-slot="visit-facts"
        className={cn(
            'm-0 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-6 gap-y-2 text-sm',
            className
        )}
        {...props}
    />
)

/** One label and its value in `VisitFacts`. */
export const VisitFact = ({ className, ...props }: ComponentProps<'div'>) => (
    <InVisitFact.Provider value>
        <div
            data-slot="visit-fact"
            className={cn('flex min-w-0 flex-col gap-0.5', className)}
            {...props}
        />
    </InVisitFact.Provider>
)

const LABEL_CLASS = 'm-0 text-dhis2-muted-foreground'

/** The fact's name: a `<dt>` inside `VisitFact`, a span anywhere else. */
export const VisitFactLabel = ({
    className,
    ...props
}: ComponentProps<'dt'>) => {
    const inFact = useContext(InVisitFact)
    const Label = inFact ? 'dt' : 'span'
    return (
        <Label
            data-slot="visit-fact-label"
            className={cn(LABEL_CLASS, className)}
            {...props}
        />
    )
}

const MUTED = 'font-normal text-dhis2-muted-foreground'

const Fallback = ({ state }: { state: Exclude<VisitFactState, 'value'> }) => {
    switch (state) {
        case 'missing':
            return <>{i18n.t('Not recorded')}</>
        case 'not-performed':
            return (
                <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">{i18n.t('Not performed')}</span>
                </>
            )
        case 'restricted':
            return <>{i18n.t('Unavailable')}</>
    }
}

export interface VisitFactValueProps extends ComponentProps<'dd'> {
    /**
     * What is known: a recorded `value` (the default), `missing` when nothing
     * was recorded, `not-performed` when the step wasn't done, or `restricted`
     * when the user can't see it. Each but `value` shows muted words of its
     * own unless you pass children.
     */
    state?: VisitFactState
}

/**
 * A fact's value: a `<dd>` inside `VisitFact`, and a span anywhere else, such
 * as a table cell, so a `<dd>` is never left outside its list. A recorded
 * value is isolated in a `<bdi>` for right-to-left text.
 */
export const VisitFactValue = ({
    state = 'value',
    className,
    children,
    ...props
}: VisitFactValueProps) => {
    const inFact = useContext(InVisitFact)
    const Value = inFact ? 'dd' : 'span'
    let content: ReactNode = children
    if (state === 'value') {
        content = <bdi>{children}</bdi>
    } else if (children === undefined || children === null) {
        content = <Fallback state={state} />
    }
    return (
        <Value
            data-slot="visit-fact-value"
            data-state={state}
            className={cn(
                'm-0 font-medium text-dhis2-foreground wrap-break-word',
                state === 'value' ? undefined : MUTED,
                className
            )}
            {...props}
        >
            {content}
        </Value>
    )
}
