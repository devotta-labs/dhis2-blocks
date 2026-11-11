import i18n from '@dhis2/d2-i18n'
import React, {
    useContext,
    useId,
    useLayoutEffect,
    useState,
    type ReactNode,
} from 'react'
import { useHeaderContext } from '../provider/context'
import { InFrameContext } from '../provider/frame'
import { DisclosureToggle } from './DisclosureToggle'
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
    // In a banner the toggle and panel join the banner's own rows.
    const inFrame = useContext(InFrameContext)
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
        <div
            data-slot="tracked-entity-details"
            // In a banner the wrapper has no box, so the host's classes go to the toggle.
            className={inFrame ? 'contents' : className}
        >
            <DisclosureToggle
                label={i18n.t('Details')}
                count={custom ? undefined : left.length}
                open={open}
                controls={listId}
                onToggle={() => setOpen((value) => !value)}
                className={inFrame ? className : undefined}
            />
            <div
                id={listId}
                data-slot="tracked-entity-panel"
                hidden={!open}
                className="pt-1.5"
            >
                {custom ? (
                    children
                ) : (
                    <dl
                        // Labels take what they need up to 40%; a longer one wraps rather than squeezing the values.
                        className="m-0 grid grid-cols-[fit-content(40%)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm [&>*]:break-words"
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
