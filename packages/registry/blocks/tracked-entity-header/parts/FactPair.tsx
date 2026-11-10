import { cn } from '@/components/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import React, { type ReactNode } from 'react'
import { setupMessage, type AttributeValueState } from './useAttributeValue'

/** A label and its value side by side, wrapping when narrow. Without a label, just the value. */
const FactPair = ({
    label,
    className,
    row,
    children,
}: {
    label?: string
    className?: string
    /** A bare dt/dd pair, for a `<dl>` the caller owns. */
    row?: boolean
    children: ReactNode
}) => {
    if (row) {
        return (
            <>
                <dt className="text-dhis2-muted-foreground">
                    {label || i18n.t('Attribute')}
                </dt>
                <dd className="m-0 font-medium text-dhis2-foreground">
                    {children}
                </dd>
            </>
        )
    }
    const classes = cn('inline-flex flex-wrap gap-x-1.5 text-sm m-0', className)
    if (!label) {
        return (
            <span data-slot="tracked-entity-fact" className={classes}>
                <span className="font-medium text-dhis2-foreground">
                    {children}
                </span>
            </span>
        )
    }
    return (
        <dl data-slot="tracked-entity-fact" className={classes}>
            <dt className="text-dhis2-muted-foreground">{label}</dt>
            <dd className="m-0 font-medium text-dhis2-foreground">
                {children}
            </dd>
        </dl>
    )
}

const Muted = ({ children }: { children: string }) => (
    <span className="font-normal text-dhis2-muted-foreground">{children}</span>
)

/** The shared rendering of a resolved attribute; `label` overrides the metadata's. */
export const AttributeFact = ({
    state,
    label,
    className,
    row,
}: {
    state: AttributeValueState
    label?: string
    className?: string
    row?: boolean
}) => {
    switch (state.kind) {
        case 'hidden':
            return null
        case 'misconfigured':
            return (
                <p
                    role="alert"
                    data-slot="tracked-entity-config-error"
                    className="m-0 rounded-dhis2-sm border border-dhis2-destructive-border bg-dhis2-destructive-subtle px-3 py-2 text-sm break-words text-dhis2-destructive-strong"
                >
                    {setupMessage(state.message)}
                </p>
            )
        case 'value':
            return (
                <FactPair
                    label={label ?? state.label}
                    className={className}
                    row={row}
                >
                    {state.text}
                </FactPair>
            )
        case 'missing':
            return (
                <FactPair
                    label={label ?? state.label}
                    className={className}
                    row={row}
                >
                    <Muted>{i18n.t('Not recorded')}</Muted>
                </FactPair>
            )
        case 'unavailable':
            return (
                <FactPair
                    label={label ?? state.label}
                    className={className}
                    row={row}
                >
                    <Muted>{i18n.t('Unavailable')}</Muted>
                </FactPair>
            )
    }
}
