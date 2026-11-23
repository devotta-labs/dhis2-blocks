import i18n from '@dhis2/d2-i18n'
import React, { type ReactNode } from 'react'
import { LinkedName } from './LinkedName'
import type { RelationshipGroup } from './resolve'

const NAMES_SHOWN = 3

const counted = (group: RelationshipGroup) => {
    const { count } = group
    if (group.kind === 'events') {
        return count === 1
            ? i18n.t('1 event')
            : i18n.t('{{count}} events', { count })
    }
    return count === 1
        ? i18n.t('1 enrollment')
        : i18n.t('{{count}} enrollments', { count })
}

/** A group's first names, then how many more; events and enrollments are only counted. `more` draws the "and N more" in place of plain text. */
export const Names = ({
    group,
    href,
    onSelect,
    more,
}: {
    group: RelationshipGroup
    href?: (trackedEntity: string) => string
    onSelect?: (trackedEntity: string) => void
    more?: (rest: number) => ReactNode
}) => {
    if (group.kind !== 'records') {
        return <>{counted(group)}</>
    }
    const rest = group.links.length - NAMES_SHOWN
    return (
        <>
            {group.links.slice(0, NAMES_SHOWN).map((link, index) => (
                <React.Fragment key={'id' in link ? link.id : `r${index}`}>
                    {index > 0 && ', '}
                    <LinkedName link={link} href={href} onSelect={onSelect} />
                </React.Fragment>
            ))}
            {rest > 0 &&
                (more ? (
                    <> {more(rest)}</>
                ) : (
                    ` ${i18n.t('and {{count}} more', { count: rest })}`
                ))}
        </>
    )
}
