import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import React, { useId, useLayoutEffect, useState, type ReactNode } from 'react'
import { useHeaderContext } from '../provider/context'
import { AttributeFact } from './FactPair'
import { resolveAttribute } from './useAttributeValue'

export interface TrackedEntityDetailsProps {
    /** Shown in place of the default list of unshown attributes. */
    children?: ReactNode
    className?: string
}

/** A disclosure, closed to start, for what no other part shows. Its own rows are never "placed". */
export function TrackedEntityDetails({
    children,
    className,
}: TrackedEntityDetailsProps) {
    const context = useHeaderContext()
    const [open, setOpen] = useState(false)
    const listId = useId()
    // Parts place their attributes in layout effects; the list waits for that pass.
    const [settled, setSettled] = useState(false)
    useLayoutEffect(() => setSettled(true), [])
    const { state, placed } = context
    if (!settled || state.status !== 'ready') {
        return null
    }
    const { metadata } = state
    const left = [
        ...[...metadata.attributes.values()].map(({ id, sortOrder }) => ({
            id,
            sortOrder,
        })),
        ...[...metadata.invalid].map(([id, { sortOrder }]) => ({
            id,
            sortOrder,
        })),
    ]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ id }) => id)
        .filter((uid) => !placed.has(uid))
    const custom =
        children !== undefined && children !== null && children !== false
    if (!custom && left.length === 0) {
        return null
    }
    return (
        <div data-slot="tracked-entity-details" className={className}>
            <Button
                variant="ghost"
                size="sm"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen((value) => !value)}
            >
                {i18n.t('Details')}
            </Button>
            <div id={listId} hidden={!open}>
                {custom ? (
                    children
                ) : (
                    <dl
                        className={cn(
                            'm-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm'
                        )}
                    >
                        {left.map((uid) => (
                            <AttributeFact
                                key={uid}
                                row
                                state={resolveAttribute(uid, context)}
                            />
                        ))}
                    </dl>
                )}
            </div>
        </div>
    )
}
