import { cn } from '@/components/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import React, { useContext, useId, useLayoutEffect } from 'react'
import { useTrackedEntityHeader } from '../hooks'
import { useHeaderContext } from '../provider/context'
import { LabelledRegionContext } from '../provider/labelledRegion'
import {
    resolveAttribute,
    setupMessage,
    useLoggedProblem,
} from './useAttributeValue'

export interface TrackedEntityNameProps {
    /** The name attributes' uids, joined in order with a space. */
    attributes: string[]
    /** The heading's id; one is made when left out. */
    id?: string
    className?: string
}

/** The tracked entity's name, as the banner's heading. */
export function TrackedEntityName({
    attributes,
    id,
    className,
}: TrackedEntityNameProps) {
    const context = useHeaderContext()
    const header = useTrackedEntityHeader()
    const { placeAttribute } = context
    const setRegionLabel = useContext(LabelledRegionContext)
    const generated = useId()
    const headingId = id ?? generated
    const ready = header.status === 'ready'
    const key = attributes.join(',')

    useLayoutEffect(() => {
        const undo = key.split(',').filter(Boolean).map(placeAttribute)
        return () => undo.forEach((fn) => fn())
    }, [key, placeAttribute])
    // Before paint, so the region is never first announced by another name.
    useLayoutEffect(() => {
        if (!ready || !setRegionLabel) {
            return undefined
        }
        setRegionLabel(headingId)
        return () => setRegionLabel(undefined)
    }, [ready, headingId, setRegionLabel])

    const parts = attributes.map((uid) =>
        resolveAttribute(uid, header, context)
    )
    const problem = parts.find((part) => part.kind === 'misconfigured')
    useLoggedProblem(problem?.message)

    if (!ready) {
        return null
    }
    const name = parts
        .map((part) => (part.kind === 'value' ? part.text.trim() : ''))
        .filter(Boolean)
        .join(' ')
    let text = name || i18n.t('Name not recorded')
    // No half identity: one unreadable name attribute makes the whole name unavailable.
    if (parts.some((part) => part.kind === 'unavailable')) {
        text = i18n.t('Name unavailable')
    }
    if (problem) {
        text = setupMessage(problem.message)
    }
    return (
        <h2
            id={headingId}
            data-slot="tracked-entity-name"
            className={cn(
                'm-0 text-xl font-semibold text-dhis2-foreground',
                className
            )}
        >
            {text}
        </h2>
    )
}
