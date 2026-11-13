import { Combobox as ComboboxPrimitive } from '@base-ui/react'
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
import { IconChevronDown16 } from '@dhis2/ui-icons'
import React, { type ReactElement } from 'react'
import type { Clinic } from './api/schemas'
import { useClinicContext } from './provider/context'
import { tileClass, tileInitial } from './tile'

export interface ClinicSelectorProps {
    /** Shows only the tile from the `md` breakpoint up, as in a collapsed sidebar. */
    collapsed?: boolean
    label?: string
    searchPlaceholder?: string
    className?: string
}

interface ClinicGroup {
    label?: string
    items: Clinic[]
}

const triggerClassName =
    'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-dhis2-md border-0 bg-transparent p-1 text-start text-sm leading-5 font-medium text-inherit hover:bg-dhis2-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dhis2-sidebar-ring data-popup-open:bg-dhis2-sidebar-accent [&_svg]:shrink-0 [&_svg]:fill-current'

function Tile({ clinic }: { clinic?: Clinic }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-dhis2-md text-sm leading-none font-medium',
                tileClass(clinic?.id ?? '')
            )}
        >
            {tileInitial(clinic?.displayName ?? '')}
        </span>
    )
}

/** Tile and name, the same in the trigger and every menu row. */
function Row({
    clinic,
    name,
    nameClassName,
}: {
    clinic?: Clinic
    name: string
    nameClassName?: string
}) {
    return (
        <span className="flex min-w-0 flex-1 items-center gap-2">
            <Tile clinic={clinic} />
            <span
                title={name}
                className={cn('min-w-0 truncate', nameClassName)}
            >
                {name}
            </span>
        </span>
    )
}

export function ClinicSelector({
    collapsed = false,
    label = i18n.t('Clinic'),
    searchPlaceholder = i18n.t('Search clinics'),
    className,
}: ClinicSelectorProps) {
    const {
        status,
        clinic,
        assigned,
        recent,
        searchable,
        query,
        setQuery,
        search,
        setClinic,
        retry,
    } = useClinicContext()
    const box = cn('flex min-h-9 items-center gap-2 text-sm', className)
    // Text that cannot fit beside a 28px tile is left to screen readers.
    const narrow = collapsed ? 'md:sr-only' : undefined

    if (status === 'pending') {
        return (
            <div className={cn(box, 'p-1', collapsed && 'md:p-0')}>
                <Skeleton className="size-7 shrink-0 bg-dhis2-sidebar-accent" />
                <Skeleton
                    className={cn(
                        'h-4 flex-1 bg-dhis2-sidebar-accent',
                        collapsed && 'md:hidden'
                    )}
                />
            </div>
        )
    }
    if (status === 'failed') {
        return (
            <div className={cn(box, 'flex-wrap')}>
                <span className={narrow}>
                    {i18n.t('Clinics could not be loaded')}
                </span>
                <Button size="sm" variant="outline" onClick={retry}>
                    {i18n.t('Retry')}
                </Button>
            </div>
        )
    }
    if (status === 'none') {
        return (
            <p className={cn(box, 'm-0')}>
                <span className={narrow}>{i18n.t('No clinic assigned')}</span>
            </p>
        )
    }

    const name = clinic?.displayName ?? i18n.t('Choose a clinic')
    const [only] = assigned
    if (!searchable && assigned.length === 1 && clinic?.id === only?.id) {
        return (
            <div
                className={cn(box, 'p-1', collapsed && 'md:p-0')}
                title={collapsed ? name : undefined}
            >
                <span className="sr-only">{`${label}: `}</span>
                <Row clinic={clinic} name={name} nameClassName={narrow} />
            </div>
        )
    }

    const triggerProps = {
        'aria-label': i18n.t('{{label}}: {{name}}', { label, name }),
        className: cn(
            triggerClassName,
            collapsed && 'md:size-7 md:p-0',
            className
        ),
        children: (
            <>
                <Row
                    clinic={clinic}
                    name={name}
                    nameClassName={collapsed ? 'md:hidden' : undefined}
                />
                <span
                    aria-hidden="true"
                    className={cn('flex', collapsed && 'md:hidden')}
                >
                    <IconChevronDown16 />
                </span>
            </>
        ),
    }
    // Collapsed, the name only shows on hover or focus, beside the tile.
    const withTooltip = (trigger: ReactElement) =>
        collapsed ? (
            <Tooltip>
                <TooltipTrigger render={trigger} />
                <TooltipContent side="right" className="max-md:hidden">
                    {name}
                </TooltipContent>
            </Tooltip>
        ) : (
            trigger
        )
    const popup = {
        side: collapsed ? ('right' as const) : ('bottom' as const),
        className: collapsed ? 'w-60' : 'w-(--anchor-width)',
    }

    if (!searchable) {
        return (
            <DropdownMenu>
                {withTooltip(<DropdownMenuTrigger {...triggerProps} />)}
                <DropdownMenuContent {...popup}>
                    <DropdownMenuRadioGroup
                        value={clinic?.id ?? null}
                        onValueChange={(id: string) => {
                            const next = assigned.find((a) => a.id === id)
                            if (next) {
                                setClinic(next)
                            }
                        }}
                    >
                        {assigned.map((a) => (
                            <DropdownMenuRadioItem
                                key={a.id}
                                value={a.id}
                                closeOnClick
                            >
                                <Row clinic={a} name={a.displayName} />
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    const groups: ClinicGroup[] =
        query.trim() === ''
            ? [
                  { label: i18n.t('Recent'), items: recent },
                  { label: i18n.t('Assigned'), items: assigned },
              ].filter((group) => group.items.length > 0)
            : [{ items: search.clinics }]

    return (
        <Combobox
            items={groups}
            // The provider filters, on the server or over the assigned list.
            filter={null}
            inputValue={query}
            onInputValueChange={setQuery}
            value={clinic ?? null}
            onValueChange={(next: Clinic | null) => {
                if (next) {
                    setClinic(next)
                }
            }}
            isItemEqualToValue={(a: Clinic, b: Clinic) => a.id === b.id}
            itemToStringLabel={(c: Clinic) => c.displayName}
        >
            {withTooltip(<ComboboxPrimitive.Trigger {...triggerProps} />)}
            <ComboboxContent {...popup}>
                <ComboboxInput
                    showTrigger={false}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                />
                <ComboboxEmpty className="flex-col items-center gap-2">
                    {search.status === 'pending' && (
                        <Spinner label={i18n.t('Loading')} />
                    )}
                    {search.status === 'failed' && (
                        <>
                            {i18n.t('Clinics could not be loaded')}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={search.retry}
                            >
                                {i18n.t('Retry')}
                            </Button>
                        </>
                    )}
                    {search.status === 'ready' && i18n.t('No clinics found')}
                </ComboboxEmpty>
                <ComboboxList>
                    {(group: ClinicGroup) => (
                        <ComboboxGroup
                            key={group.label ?? 'results'}
                            items={group.items}
                        >
                            {group.label && (
                                <ComboboxLabel>{group.label}</ComboboxLabel>
                            )}
                            <ComboboxCollection>
                                {(c: Clinic) => (
                                    <ComboboxItem
                                        key={c.id}
                                        value={c}
                                        // The check trails the name, as in the menu.
                                        className="flex-row-reverse gap-2 ps-3 pe-1.5"
                                    >
                                        <Row clinic={c} name={c.displayName} />
                                    </ComboboxItem>
                                )}
                            </ComboboxCollection>
                        </ComboboxGroup>
                    )}
                </ComboboxList>
                {search.hasMore && (
                    <p className="m-0 px-3 py-2 text-[13px] leading-4 text-dhis2-muted-foreground">
                        {i18n.t('Keep typing to narrow the results')}
                    </p>
                )}
            </ComboboxContent>
        </Combobox>
    )
}
