import { Combobox as ComboboxPrimitive, type BaseUIEvent } from '@base-ui/react'
import { announce } from '@/components/dhis2/ui/announcer'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Combobox,
    ComboboxCollection,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxGroup,
    ComboboxInput,
    ComboboxItem,
    ComboboxLabel,
    ComboboxList,
} from '@/components/dhis2/ui/combobox'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/dhis2/ui/dropdown-menu'
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/dhis2/ui/tooltip'
import i18n from '@dhis2/d2-i18n'
import { IconCheckmark16, IconChevronDown16, IconSync16 } from '@dhis2/ui-icons'
import React, {
    useEffect,
    useRef,
    useState,
    type MouseEvent,
    type ReactElement,
} from 'react'
import type { OrgUnit } from './api/schemas'
import { useOrgUnitContext } from './provider/context'
import { useOrgUnitSearch } from './search'
import { defaultTexts, triggerLabel, type OrgUnitSwitcherTexts } from './texts'
import { tileClass, tileInitial } from './tile'

export interface OrgUnitSwitcherProps {
    /** Shows only the tile from the `md` breakpoint up, as in a collapsed sidebar. */
    collapsed?: boolean
    /** What the switcher calls the units, such as clinics or schools; the rest keep their defaults. */
    texts?: Partial<OrgUnitSwitcherTexts>
    /** Whether the menu is open, when the host owns that. */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    className?: string
}

interface OrgUnitGroup {
    key: string
    label: string
    items: OrgUnit[]
}

/** Stands in the list for the row that loads the next page; no unit has an empty id. */
const MORE: OrgUnit = { id: '', displayName: '', path: '' }

const triggerClassName =
    'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-dhis2-sm border-0 bg-transparent p-1 text-start text-sm leading-5 font-medium text-dhis2-foreground hover:bg-dhis2-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dhis2-ring data-popup-open:bg-dhis2-accent [&_svg]:shrink-0 [&_svg]:fill-current'

const tileOnly =
    'hidden size-6 shrink-0 items-center justify-center rounded-dhis2-md bg-dhis2-accent text-dhis2-foreground md:flex'

/**
 * The full text beside a tile or a shortened name, on hover and focus. A
 * collapsed tile only needs it from `md` up, where the text is hidden.
 */
function Tip({
    show,
    text,
    wideOnly = false,
    children,
}: {
    show: boolean
    text: string
    wideOnly?: boolean
    children: ReactElement
}) {
    if (!show) {
        return children
    }
    return (
        <Tooltip>
            <TooltipTrigger render={children} />
            <TooltipContent
                side="right"
                className={wideOnly ? 'max-md:hidden' : undefined}
            >
                {text}
            </TooltipContent>
        </Tooltip>
    )
}

/** Whether an element's text is cut off, checked again as it resizes or the text changes. */
function useCutOff(text: string) {
    const [element, setElement] = useState<HTMLElement | null>(null)
    const [cutOff, setCutOff] = useState(false)
    useEffect(() => {
        if (!element) {
            return
        }
        const check = () => setCutOff(element.scrollWidth > element.clientWidth)
        check()
        const observer = new ResizeObserver(check)
        observer.observe(element)
        return () => observer.disconnect()
    }, [element, text])
    return [setElement, cutOff] as const
}

function Tile({ orgUnit }: { orgUnit?: OrgUnit }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-dhis2-md text-xs leading-none font-semibold',
                tileClass(orgUnit?.id ?? '')
            )}
        >
            {tileInitial(orgUnit?.displayName ?? '')}
        </span>
    )
}

/**
 * Announces every change of unit once the units are ready, whoever made it.
 * What is current when they become ready, a unit or none, is said by the
 * trigger, so only later changes are announced.
 */
function useChangeAnnouncement(
    ready: boolean,
    id: string | undefined,
    userId: string | undefined,
    message: string | undefined
) {
    const said = useRef<{ userId?: string; id?: string }>()
    useEffect(() => {
        if (!ready) {
            return
        }
        const before = said.current
        said.current = { userId, id }
        if (
            message !== undefined &&
            before &&
            before.userId === userId &&
            before.id !== id
        ) {
            announce(message)
        }
    }, [ready, id, userId, message])
}

/** Tile and name, the same in the trigger and every menu row. */
function Row({
    orgUnit,
    name,
    nameClassName,
    nameRef,
    title,
    decorative,
    collapsed = false,
}: {
    orgUnit?: OrgUnit
    name: string
    nameClassName?: string
    nameRef?: (element: HTMLElement | null) => void
    title?: string
    /** Hidden from assistive technology, which reads the full name elsewhere. */
    decorative?: boolean
    /** From `md` up only the tile shows, centred by its container. */
    collapsed?: boolean
}) {
    return (
        <span
            title={title}
            aria-hidden={decorative}
            className={cn(
                'flex min-w-0 flex-1 items-center gap-2',
                collapsed && 'md:flex-none'
            )}
        >
            <Tile orgUnit={orgUnit} />
            <span ref={nameRef} className={cn('min-w-0', nameClassName)}>
                {name}
            </span>
        </span>
    )
}

/** A menu row: the full name over two lines, and on hover when longer still. */
function MenuRow({ orgUnit }: { orgUnit: OrgUnit }) {
    return (
        <Row
            orgUnit={orgUnit}
            name={orgUnit.displayName}
            nameClassName="line-clamp-2 break-words"
            title={orgUnit.displayName}
        />
    )
}

export function OrgUnitSwitcher({
    collapsed = false,
    texts,
    open,
    onOpenChange,
    className,
}: OrgUnitSwitcherProps) {
    const { state, actions, source } = useOrgUnitContext()
    const { status, orgUnit, assigned, recent } = state
    const { setOrgUnit, retry } = actions
    const t = { ...defaultTexts(), ...texts }
    useChangeAnnouncement(
        status === 'ready',
        orgUnit?.id,
        source.userId,
        orgUnit && t.changed(orgUnit.displayName)
    )
    const search = useOrgUnitSearch()
    const { query, setQuery, browse, searchable } = search
    // The trigger shows the short name; the full one is its label and tooltip.
    const fullName = orgUnit?.displayName ?? t.choose
    const shownName = orgUnit?.displayShortName ?? fullName
    const [nameRef, cutOff] = useCutOff(shownName)
    const partHidden = cutOff || shownName !== fullName
    // A host that holds the menu open has opened it.
    useEffect(() => {
        if (open) {
            browse()
        }
    }, [open, browse])
    const changeOpen = (next: boolean) => {
        if (next) {
            browse()
        }
        onOpenChange?.(next)
    }
    const box = cn(
        'flex min-h-9 items-center gap-2 text-sm text-dhis2-foreground',
        collapsed && 'md:justify-center',
        className
    )
    // From `md` up a collapsed switcher has a narrow column, so text there gives way to a tile centred in it, in line with the navigation's icons.
    const wide = collapsed ? 'md:hidden' : undefined

    if (status === 'pending') {
        return (
            <div
                aria-busy="true"
                className={cn(box, 'p-1', collapsed && 'md:p-0')}
            >
                <span className="sr-only">{i18n.t('Loading')}</span>
                <Skeleton className="size-6 shrink-0" />
                <Skeleton className={cn('h-4 flex-1', wide)} />
            </div>
        )
    }
    if (status === 'failed') {
        const message = t.loadFailed
        return (
            <div className={cn(box, 'flex-wrap')}>
                <span className={cn('contents', wide)}>
                    <span>{message}</span>
                    <Button size="sm" variant="outline" onClick={retry}>
                        {i18n.t('Retry')}
                    </Button>
                </span>
                {collapsed && (
                    <Tip show wideOnly text={message}>
                        <button
                            type="button"
                            aria-label={i18n.t('Retry')}
                            onClick={retry}
                            className={cn(
                                tileOnly,
                                'cursor-pointer border-0 p-0 hover:bg-dhis2-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dhis2-ring [&_svg]:fill-current'
                            )}
                        >
                            <IconSync16 />
                        </button>
                    </Tip>
                )}
            </div>
        )
    }
    if (status === 'none') {
        const message = t.noneAssigned
        return (
            <div className={box}>
                <p className={cn('m-0', wide)}>{message}</p>
                {collapsed && (
                    <Tip show wideOnly text={message}>
                        <span
                            role="img"
                            aria-label={message}
                            className={tileOnly}
                        />
                    </Tip>
                )}
            </div>
        )
    }

    const fullLabel = triggerLabel(t.label, fullName)
    // Collapsed, the tile needs its name from `md` up; a shortened name needs the full one everywhere.
    const tip = {
        show: collapsed || partHidden,
        text: fullName,
        wideOnly: !partHidden,
    }
    const [only] = assigned
    if (!searchable && assigned.length === 1 && orgUnit?.id === only?.id) {
        return (
            <Tip {...tip}>
                <div className={cn(box, 'p-1', collapsed && 'md:p-0')}>
                    <span className="sr-only">{fullLabel}</span>
                    <Row
                        decorative
                        collapsed={collapsed}
                        orgUnit={orgUnit}
                        name={shownName}
                        nameRef={nameRef}
                        nameClassName={cn('truncate', collapsed && 'md:hidden')}
                    />
                </div>
            </Tip>
        )
    }

    const triggerProps = {
        'aria-label': fullLabel,
        className: cn(
            triggerClassName,
            collapsed && 'md:h-8 md:justify-center md:p-0',
            className
        ),
        children: (
            <>
                <Row
                    collapsed={collapsed}
                    orgUnit={orgUnit}
                    name={shownName}
                    nameRef={nameRef}
                    nameClassName={cn('truncate', wide)}
                />
                <span aria-hidden="true" className={cn('flex', wide)}>
                    <IconChevronDown16 />
                </span>
            </>
        ),
    }
    const popup = {
        side: collapsed ? ('right' as const) : ('bottom' as const),
        // Wide enough for unit names whatever the sidebar's width, and never wider than the screen.
        className: 'w-90 max-w-[calc(100vw-1rem)]',
    }

    if (!searchable) {
        return (
            <DropdownMenu open={open} onOpenChange={onOpenChange}>
                <Tip {...tip}>
                    <DropdownMenuTrigger {...triggerProps} />
                </Tip>
                <DropdownMenuContent {...popup}>
                    <DropdownMenuRadioGroup
                        value={orgUnit?.id ?? null}
                        onValueChange={(id: string) => {
                            const next = assigned.find((a) => a.id === id)
                            if (next) {
                                setOrgUnit(next)
                            }
                        }}
                    >
                        {assigned.map((a) => (
                            <DropdownMenuRadioItem
                                key={a.id}
                                value={a.id}
                                closeOnClick
                                className="pe-8"
                            >
                                <MenuRow orgUnit={a} />
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    const blank = query.trim() === ''
    const above = new Set([...recent, ...assigned].map((c) => c.id))
    const lists: OrgUnitGroup[] = (
        blank
            ? [
                  { key: 'recent', label: i18n.t('Recent'), items: recent },
                  {
                      key: 'assigned',
                      label: i18n.t('Assigned'),
                      items: assigned,
                  },
                  {
                      key: 'all',
                      label: t.allUnits,
                      // Once is enough for a unit already listed above.
                      items: search.orgUnits.filter((c) => !above.has(c.id)),
                  },
              ]
            : [{ key: 'results', label: '', items: search.orgUnits }]
    ).filter((group) => group.items.length > 0)
    // Headings only tell lists apart, so one list goes without.
    const headed = lists.length > 1
    // The row that loads the next page is an item, so the arrow keys reach it.
    const groups =
        search.hasMore && lists.length > 0
            ? [...lists, { key: 'more', label: '', items: [MORE] }]
            : lists
    // Where the search stands: shown in place of an empty list, or below the assigned units.
    let searchStatus: ReactElement | undefined
    if (search.status === 'pending') {
        searchStatus = <Spinner label={i18n.t('Loading')} />
    } else if (search.status === 'failed') {
        searchStatus = (
            <>
                {t.loadFailed}
                <Button size="sm" variant="outline" onClick={search.retry}>
                    {i18n.t('Retry')}
                </Button>
            </>
        )
    }
    let moreLabel = i18n.t('Show more')
    if (search.loadingMore) {
        moreLabel = t.loadingMore
    } else if (search.moreFailed) {
        moreLabel = t.moreFailed
    }
    // Stops the list's own handler, which would choose the row and close the menu.
    const keepOpen = (event: BaseUIEvent<MouseEvent>) =>
        event.preventBaseUIHandler()
    const loadMore = (event: BaseUIEvent<MouseEvent>) => {
        keepOpen(event)
        if (!search.loadingMore) {
            search.loadMore()
        }
    }

    return (
        <Combobox
            open={open}
            onOpenChange={changeOpen}
            items={groups}
            // The provider filters, on the server or over the assigned list.
            filter={null}
            inputValue={query}
            onInputValueChange={setQuery}
            value={orgUnit ?? null}
            onValueChange={(next: OrgUnit | null) => {
                if (next) {
                    setOrgUnit(next)
                }
            }}
            isItemEqualToValue={(a: OrgUnit, b: OrgUnit) => a.id === b.id}
            itemToStringLabel={(c: OrgUnit) => c.displayName}
        >
            <Tip {...tip}>
                <ComboboxPrimitive.Trigger {...triggerProps} />
            </Tip>
            <ComboboxContent {...popup}>
                <ComboboxInput
                    showTrigger={false}
                    className="[&_input]:ps-2"
                    placeholder={t.searchPlaceholder}
                    aria-label={t.searchPlaceholder}
                />
                <ComboboxEmpty className="flex-col items-center gap-2">
                    {searchStatus ?? t.noResults}
                </ComboboxEmpty>
                <ComboboxList className="max-h-[min(300px,calc(var(--available-height)---spacing(11)))]">
                    {(group: OrgUnitGroup) => (
                        <ComboboxGroup key={group.key} items={group.items}>
                            {headed && group.label !== '' && (
                                <ComboboxLabel className="pt-3 pb-0.5">
                                    {group.label}
                                </ComboboxLabel>
                            )}
                            <ComboboxCollection>
                                {(c: OrgUnit) =>
                                    c === MORE ? (
                                        <ComboboxItem
                                            key="more"
                                            value={c}
                                            // Busy, it stays in place and says so, and a press does nothing.
                                            aria-busy={search.loadingMore}
                                            onClick={loadMore}
                                            // A click follows the release and loads the page, once.
                                            onMouseUp={keepOpen}
                                            className="justify-center px-3 text-[13px] font-medium text-dhis2-primary *:first:hidden"
                                        >
                                            {moreLabel}
                                        </ComboboxItem>
                                    ) : (
                                        <ComboboxItem
                                            key={c.id}
                                            value={c}
                                            // Its own leading check and selected tint give way to the menu's trailing check.
                                            className="gap-2 ps-3 pe-8 *:first:hidden data-selected:bg-dhis2-popover data-selected:data-highlighted:bg-dhis2-accent"
                                        >
                                            <MenuRow orgUnit={c} />
                                            <span className="pointer-events-none absolute end-3 flex items-center justify-center">
                                                <ComboboxPrimitive.ItemIndicator>
                                                    <IconCheckmark16 />
                                                </ComboboxPrimitive.ItemIndicator>
                                            </span>
                                        </ComboboxItem>
                                    )
                                }
                            </ComboboxCollection>
                        </ComboboxGroup>
                    )}
                </ComboboxList>
                {/* With no query the assigned units always show, so the rest of the hierarchy reports below them. */}
                {blank && searchStatus && (
                    <div className="flex flex-col items-center gap-2 px-3 py-2 text-sm">
                        {searchStatus}
                    </div>
                )}
            </ComboboxContent>
        </Combobox>
    )
}
