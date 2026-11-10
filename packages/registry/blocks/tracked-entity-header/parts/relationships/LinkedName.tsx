import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { Muted } from '../FactPair'
import type { ResolvedLink } from './resolve'

const LINK_CLASS =
    'cursor-pointer rounded-dhis2-sm text-dhis2-primary underline underline-offset-2 hover:text-dhis2-primary-strong focus-visible:outline-2 focus-visible:outline-dhis2-ring'

/** A linked record's name: a link, a button, or plain text, by the navigation the caller gave. */
export const LinkedName = ({
    link,
    href,
    onSelect,
}: {
    link: ResolvedLink
    href?: (trackedEntity: string) => string
    onSelect?: (trackedEntity: string) => void
}) => {
    if ('restricted' in link) {
        return <Muted>{i18n.t("You don't have access to this record")}</Muted>
    }
    const { id, name } = link
    if (href) {
        return (
            <a
                href={href(id)}
                className={LINK_CLASS}
                onClick={(event) => {
                    const plain =
                        event.button === 0 &&
                        !(
                            event.ctrlKey ||
                            event.metaKey ||
                            event.shiftKey ||
                            event.altKey
                        )
                    if (onSelect && plain) {
                        event.preventDefault()
                        onSelect(id)
                    }
                }}
            >
                {name}
            </a>
        )
    }
    if (onSelect) {
        return (
            <button
                type="button"
                className={`${LINK_CLASS} border-0 bg-transparent p-0 font-[inherit]`}
                onClick={() => onSelect(id)}
            >
                {name}
            </button>
        )
    }
    return <>{name}</>
}
