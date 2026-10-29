import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { POPOVER_CLASS } from './CellStatus'

interface OptionListProps {
    id: string
    /** Ids of the header cells that name the cell, and so its list. */
    labelledBy: string
    /** The matches drawn, best first. */
    codes: ReadonlyArray<string>
    names: ReadonlyMap<string, ReactNode>
    /** The highlighted match, which Enter picks; -1 for none. */
    active: number
    /** "Showing … of … matches", when more match than are drawn; the cell announces it. */
    count: string
    optionId(code: string): string
    onPick(code: string): void
    /** Drawn in place, in an editor, rather than over the grid under the cell. */
    inline?: boolean
}

/**
 * The open list of an option cell, below it (above when there is no room): the matches, the highlighted one kept in
 * view, and the count when more match than are drawn. Focus stays in the cell, which points at the highlighted match
 * and announces the count. An editor's search lists its results in it too, in place.
 */
export const OptionList = ({
    id,
    labelledBy,
    codes,
    names,
    active,
    count,
    optionId,
    onPick,
    inline = false,
}: OptionListProps) => {
    const list = useRef<HTMLDivElement>(null)
    useLayoutEffect(() => {
        list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
    }, [active])
    return (
        // Focus stays in the cell, which saves the pick, whatever part of the list is pressed.
        <div
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
                'overflow-hidden rounded-dhis2-sm border border-dhis2-grey-200 bg-dhis2-popover text-dhis2-popover-foreground',
                !inline && [
                    POPOVER_CLASS,
                    'z-50 w-max max-w-[min(30rem,90vw)] min-w-full supports-[anchor-name:--a]:min-w-[anchor-size(width)] shadow-dhis2-popover',
                ]
            )}
        >
            <div
                ref={list}
                id={id}
                role="listbox"
                aria-labelledby={labelledBy}
                className="max-h-64 overflow-y-auto overscroll-contain"
            >
                {codes.map((code, index) => (
                    <div
                        key={code}
                        id={optionId(code)}
                        role="option"
                        aria-selected={index === active}
                        onClick={() => onPick(code)}
                        className="cursor-pointer px-3 py-2 text-sm text-dhis2-grey-900 aria-selected:bg-dhis2-grey-200"
                    >
                        {names.get(code)}
                    </div>
                ))}
            </div>
            {count === '' ? null : (
                <p className="border-t border-dhis2-grey-200 px-3 py-1.5 text-xs text-dhis2-grey-700">
                    {count}
                </p>
            )}
        </div>
    )
}
