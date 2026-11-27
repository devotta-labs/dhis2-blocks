import i18n from '@dhis2/d2-i18n'
import { IconLocation16, IconSearch16 } from '@dhis2/ui-icons'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { announce } from '@/components/dhis2/ui/announcer'
import { cn } from '@/components/dhis2/ui/cn'
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/components/dhis2/ui/input-group'
import { Kbd } from '@/components/dhis2/ui/kbd'
import { Spinner } from '@/components/dhis2/ui/spinner'
import type { PlaceResult, PlaceSearch as Search } from './search'

const foundWords = (count: number) => {
    if (count === 0) return i18n.t('No places found')
    return count === 1
        ? i18n.t('1 place found')
        : i18n.t('{{count}} places found', { count })
}

type Found =
    | { kind: 'idle' }
    | { kind: 'searching' }
    | { kind: 'found'; places: readonly PlaceResult[] }
    | { kind: 'failed' }

/**
 * A search box over the map. It searches on Enter, not as the user types, and says so with an Enter key at its end
 * once there is text, which a click or tap also presses. The places found drop below; arrow keys move between the box
 * and them, and Escape closes the list.
 */
export const PlaceSearch = ({
    search,
    onPick,
    className,
}: {
    search: Search
    onPick: (place: PlaceResult) => void
    className?: string
}) => {
    const [query, setQuery] = useState('')
    // What the places listed were found for, so the Enter key shows only while the text is new.
    const [searched, setSearched] = useState<string>()
    const [found, setFound] = useState<Found>({ kind: 'idle' })
    const pending = useRef<AbortController>()
    const box = useRef<HTMLInputElement>(null)
    const list = useRef<HTMLUListElement>(null)
    useEffect(() => () => pending.current?.abort(), [])

    const run = async () => {
        const text = query.trim()
        if (text === '') return
        pending.current?.abort()
        const controller = new AbortController()
        pending.current = controller
        setSearched(text)
        setFound({ kind: 'searching' })
        try {
            const places = await search(text, controller.signal)
            if (controller.signal.aborted) return
            setFound({ kind: 'found', places })
            announce(foundWords(places.length))
        } catch {
            if (controller.signal.aborted) return
            setFound({ kind: 'failed' })
            announce(i18n.t('Search is not available right now'), 'assertive')
        }
    }

    const options = () => [...(list.current?.querySelectorAll('button') ?? [])]
    const close = () => setFound({ kind: 'idle' })

    const onBoxKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            void run()
        } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            options()[0]?.focus()
        } else if (event.key === 'Escape' && found.kind !== 'idle') {
            event.stopPropagation()
            close()
        }
    }
    const onOptionKey = (event: KeyboardEvent<HTMLButtonElement>) => {
        const all = options()
        const at = all.findIndex((each) => each === document.activeElement)
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            all[Math.min(at + 1, all.length - 1)]?.focus()
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (at <= 0) box.current?.focus()
            else all[at - 1]?.focus()
        } else if (event.key === 'Escape') {
            event.stopPropagation()
            close()
            box.current?.focus()
        }
    }

    const open = found.kind === 'found' || found.kind === 'failed'
    const fresh =
        query.trim() !== '' &&
        query.trim() !== searched &&
        found.kind !== 'searching'
    return (
        <div className={cn('relative', className)}>
            <InputGroup className="h-8">
                <InputGroupAddon align="inline-start">
                    <IconSearch16 />
                </InputGroupAddon>
                <InputGroupInput
                    ref={box}
                    type="search"
                    value={query}
                    enterKeyHint="search"
                    autoComplete="off"
                    aria-label={i18n.t('Search for a place')}
                    aria-expanded={open}
                    aria-keyshortcuts="Enter"
                    className="[&::-webkit-search-cancel-button]:appearance-none"
                    placeholder={i18n.t('Search for a place')}
                    onChange={(event) => {
                        setQuery(event.target.value)
                        if (found.kind !== 'searching') close()
                    }}
                    onKeyDown={onBoxKey}
                />
                {found.kind === 'searching' ? (
                    <InputGroupAddon align="inline-end">
                        <Spinner className="size-4" />
                    </InputGroupAddon>
                ) : null}
                {fresh ? (
                    <InputGroupAddon align="inline-end" className="pe-1">
                        <InputGroupButton
                            size="xs"
                            className="h-6 px-0.5"
                            aria-label={i18n.t('Search')}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => void run()}
                        >
                            <Kbd>
                                {i18n.t('Enter')}
                                <span aria-hidden="true">↵</span>
                            </Kbd>
                        </InputGroupButton>
                    </InputGroupAddon>
                ) : null}
            </InputGroup>
            {open ? (
                <div className="absolute inset-x-0 top-full z-[1100] mt-1 rounded-dhis2-md border border-dhis2-border bg-dhis2-background p-1 shadow-md">
                    {found.kind === 'failed' ? (
                        <p className="m-0 px-2 py-1.5 text-sm text-dhis2-muted-foreground">
                            {i18n.t('Search is not available right now')}
                        </p>
                    ) : null}
                    {found.kind === 'found' && found.places.length === 0 ? (
                        <p className="m-0 px-2 py-1.5 text-sm text-dhis2-muted-foreground">
                            {i18n.t('No places found')}
                        </p>
                    ) : null}
                    {found.kind === 'found' && found.places.length > 0 ? (
                        <ul
                            ref={list}
                            aria-label={i18n.t('Places found')}
                            className="m-0 flex max-h-64 list-none flex-col overflow-y-auto p-0"
                        >
                            {found.places.map((place, index) => (
                                <li
                                    // Places have no ids, and the list is replaced whole.
                                    // eslint-disable-next-line react/no-array-index-key
                                    key={index}
                                >
                                    <button
                                        type="button"
                                        onKeyDown={onOptionKey}
                                        className="flex w-full items-start gap-2 rounded-dhis2-sm px-2 py-1.5 text-start outline-none hover:bg-dhis2-background-subtle focus-visible:bg-dhis2-background-subtle focus-visible:ring-2 focus-visible:ring-dhis2-ring"
                                        onClick={() => {
                                            close()
                                            setQuery(place.name)
                                            setSearched(place.name)
                                            onPick(place)
                                        }}
                                    >
                                        <span className="mt-0.5 shrink-0 text-dhis2-subtle-foreground">
                                            <IconLocation16 />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm text-dhis2-foreground">
                                                {place.name}
                                            </span>
                                            {place.detail ? (
                                                <span className="block truncate text-xs text-dhis2-muted-foreground">
                                                    {place.detail}
                                                </span>
                                            ) : null}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}
