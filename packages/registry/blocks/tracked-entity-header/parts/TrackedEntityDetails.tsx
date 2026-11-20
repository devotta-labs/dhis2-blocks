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

    const inFrame = useContext(InFrameContext)
    const [open, setOpen] = useState(false)
    const listId = useId()

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
                    <dl className="m-0 grid grid-cols-[fit-content(40%)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm [&>*]:break-words">
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
