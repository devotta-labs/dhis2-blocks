import { Skeleton } from '@/components/dhis2/ui/skeleton'
import i18n from '@dhis2/d2-i18n'
import React, { useMemo } from 'react'
import type { RelationshipEnd } from '../api/types'
import { FactPair, Muted } from './FactPair'
import { Names } from './relationships/Names'
import { labelFor, type RelationshipLabel } from './relationships/resolve'
import { useRelationships } from './relationships/useRelationships'

export interface TrackedEntityRelationshipProps {
    /** The relationship type's id. */
    relationshipType: string
    /** Shows only the links where this record is this end of a one-way type. */
    end?: RelationshipEnd
    /** Replaces the relationship type's name, or one per end. */
    label?: RelationshipLabel
    /** Shows nothing, not "Not recorded", when the record has no such link. */
    hideWhenEmpty?: boolean
    /** Where a linked record lives; renders the name as a link. */
    href?: (trackedEntity: string) => string
    /** Called with a linked record's id when its name is chosen. */
    onSelect?: (trackedEntity: string) => void
    className?: string
}

/** The record's link of one relationship type, e.g. "Mother · Fatmata Sesay". */
export function TrackedEntityRelationship({
    relationshipType,
    end,
    label,
    hideWhenEmpty,
    href,
    onSelect,
    className,
}: TrackedEntityRelationshipProps) {
    const labels = useMemo(
        () => (label === undefined ? undefined : { [relationshipType]: label }),
        [relationshipType, label]
    )
    const extraTypes = useMemo(() => [relationshipType], [relationshipType])
    const state = useRelationships(labels, extraTypes)
    if (state.kind === 'hidden') {
        return null
    }
    if (state.kind === 'loading') {
        return <Skeleton className="h-5 w-40" />
    }
    const groups =
        state.kind === 'ready'
            ? state.groups.filter(
                  (group) =>
                      group.type === relationshipType &&
                      (end === undefined ||
                          group.end === 'both' ||
                          group.end === end)
              )
            : []
    if (groups.length === 0) {
        if (state.kind === 'ready' && hideWhenEmpty) {
            return null
        }
        const meta =
            state.kind === 'ready'
                ? state.types.get(relationshipType)
                : undefined
        const fallback = meta?.name ?? i18n.t('Relationship')
        // A one-way type with no `end` has no end to name: it keeps the type's own name.
        const emptyLabel =
            end === undefined && !meta?.bidirectional && label === undefined
                ? fallback
                : labelFor(
                      meta,
                      meta?.bidirectional ? 'both' : (end ?? 'from'),
                      fallback,
                      label
                  )
        return (
            <FactPair label={emptyLabel} className={className}>
                <Muted>
                    {state.kind === 'ready'
                        ? i18n.t('Not recorded')
                        : i18n.t('Unavailable')}
                </Muted>
            </FactPair>
        )
    }
    return (
        <>
            {groups.map((group) => (
                <FactPair
                    key={group.key}
                    label={group.label}
                    className={className}
                >
                    <Names group={group} href={href} onSelect={onSelect} />
                </FactPair>
            ))}
        </>
    )
}
