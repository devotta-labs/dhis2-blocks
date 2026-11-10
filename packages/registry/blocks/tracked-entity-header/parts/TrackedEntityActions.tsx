import { cn } from '@/components/dhis2/ui/cn'
import React, { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ActionsSlotContext } from '../provider/actionsSlot'

export interface TrackedEntityActionsProps {
    children: ReactNode
    className?: string
}

/**
 * Where the caller's buttons go. Always renders, whatever state the record is
 * in. A frame with a place for actions gets them there; elsewhere they stay
 * where they are placed.
 */
export function TrackedEntityActions({
    children,
    className,
}: TrackedEntityActionsProps) {
    const slot = useContext(ActionsSlotContext)
    const actions = (
        <div
            data-slot="tracked-entity-actions"
            className={cn('flex flex-wrap items-center gap-2', className)}
        >
            {children}
        </div>
    )
    if (slot === undefined) {
        return actions
    }
    // Inside a frame, nothing until its place exists, so they never flash in line.
    return slot.element ? createPortal(actions, slot.element) : null
}
