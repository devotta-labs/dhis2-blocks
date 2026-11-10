import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import i18n from '@dhis2/d2-i18n'
import React, { useId, useState } from 'react'
import { InFrameContext } from '../provider/frame'
import { FactPair, Muted } from './FactPair'
import { isPlainClick, LINK_CLASS } from './relationships/LinkedName'
import { Names } from './relationships/Names'
import type {
    RelationshipGroup,
    RelationshipLabel,
} from './relationships/resolve'
import { useRelationships } from './relationships/useRelationships'

export interface TrackedEntityRelationshipsProps {
    /** Replaces a relationship type's name, or one per end, by the type's id. */
    labels?: Readonly<Record<string, RelationshipLabel>>
    /** Where a linked record lives; renders the names as links. */
    href?: (trackedEntity: string) => string
    /** Called with a linked record's id when its name is chosen. */
    onSelect?: (trackedEntity: string) => void
    /** Where the rest of a type's links live; renders "and N more" as a link. */
    moreHref?: (relationshipType: string) => string
    /** Called with a relationship type's id when "and N more" is chosen. */
    onMore?: (relationshipType: string) => void
    className?: string
}

type MoreProps = Pick<TrackedEntityRelationshipsProps, 'moreHref' | 'onMore'>

const More = ({
    group,
    rest,
    moreHref,
    onMore,
}: MoreProps & { group: RelationshipGroup; rest: number }) => {
    const text = i18n.t('and {{count}} more', { count: rest })
    if (!moreHref && !onMore) {
        return <>{text}</>
    }
    const props = {
        'aria-label': i18n.t('and {{count}} more {{label}}', {
            count: rest,
            label: group.label,
            interpolation: { escapeValue: false },
        }),
    }
    if (moreHref) {
        return (
            <a
                {...props}
                className={LINK_CLASS}
                href={moreHref(group.type)}
                onClick={(event) => {
                    if (onMore && isPlainClick(event)) {
                        event.preventDefault()
                        onMore(group.type)
                    }
                }}
            >
                {text}
            </a>
        )
    }
    return (
        <button
            {...props}
            type="button"
            className={`${LINK_CLASS} border-0 bg-transparent p-0 font-[inherit]`}
            onClick={() => onMore?.(group.type)}
        >
            {text}
        </button>
    )
}

/** Every link of the record, one line per relationship type: its label, how many, the first names. */
export function TrackedEntityRelationships({
    labels,
    href,
    onSelect,
    moreHref,
    onMore,
    className,
}: TrackedEntityRelationshipsProps) {
    const inFrame = React.useContext(InFrameContext)
    const [open, setOpen] = useState(false)
    const listId = useId()
    const state = useRelationships(labels)
    const slot = 'tracked-entity-relationships'
    if (state.kind === 'hidden' || (state.kind === 'loading' && inFrame)) {
        return null
    }
    if (state.kind === 'loading') {
        return <Skeleton className={cn('h-5 w-40', className)} />
    }
    if (state.kind === 'unavailable') {
        return (
            <div data-slot={slot} className={className}>
                <FactPair label={i18n.t('Related')}>
                    <Muted>{i18n.t('Unavailable')}</Muted>
                </FactPair>
            </div>
        )
    }
    const { groups } = state
    if (groups.length === 0) {
        return inFrame ? null : (
            <div data-slot={slot} className={className}>
                <Muted>{i18n.t('No related records')}</Muted>
            </div>
        )
    }
    const total = groups.reduce((sum, { count }) => sum + count, 0)
    const list = (
        <div
            id={inFrame ? listId : undefined}
            hidden={inFrame && !open}
            className={cn(
                'flex gap-x-5 gap-y-1',
                inFrame ? 'flex-col' : 'flex-wrap'
            )}
        >
            {groups.map((group) => (
                <FactPair key={group.key} label={group.label}>
                    {group.kind === 'records' && (
                        <>
                            <span data-slot="tracked-entity-relationship-count">
                                {group.count}
                            </span>{' '}
                        </>
                    )}
                    <Names
                        group={group}
                        href={href}
                        onSelect={onSelect}
                        more={(rest) => (
                            <More
                                group={group}
                                rest={rest}
                                moreHref={moreHref}
                                onMore={onMore}
                            />
                        )}
                    />
                </FactPair>
            ))}
        </div>
    )
    return (
        <div data-slot={slot} className={className}>
            {inFrame && (
                <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => setOpen((value) => !value)}
                >
                    {i18n.t('Related')} ·{' '}
                    <span data-slot="tracked-entity-relationships-count">
                        {total}
                    </span>
                </Button>
            )}
            {list}
        </div>
    )
}
