import i18n from '@dhis2/d2-i18n'
import React, { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'
import { IconErrorFilled24 } from '@dhis2/ui-icons'
import { Alert, AlertTitle } from '@/components/dhis2/ui/alert'
import { announce } from '@/components/dhis2/ui/announcer'
import { cn } from '@/components/dhis2/ui/cn'
import { Spinner } from '@/components/dhis2/ui/spinner'
import { useFinderResults } from '../hooks'
import { useFinderModel } from '../provider/useFinderModel'

export type FinderSearchingProps = ComponentPropsWithoutRef<'div'>
export type FinderEmptyProps = ComponentPropsWithoutRef<'div'>
export type FinderTooManyProps = ComponentPropsWithoutRef<'div'>
export type FinderErrorProps = ComponentPropsWithoutRef<'div'>

const STATE_TEXT = 'flex items-center gap-2 text-sm text-dhis2-muted-foreground'

const announcementText = (node: Node): string => {
    if (node instanceof Element) {
        if (
            node.getAttribute('aria-hidden') === 'true' ||
            node.hasAttribute('hidden')
        ) {
            return ''
        }
        const label = node.getAttribute('aria-label')
        if (label) return ` ${label} `
        if (node instanceof HTMLImageElement && node.alt) return ` ${node.alt} `
    }
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    return Array.from(node.childNodes, announcementText).join('')
}

const useStatusAnnouncement = (active: boolean) => {
    const ref = useRef<HTMLDivElement>(null)
    const previous = useRef('')
    useEffect(() => {
        const element = ref.current
        if (!active || !element) {
            previous.current = ''
            return
        }
        const say = () => {
            const text = announcementText(element).replace(/\s+/g, ' ').trim()
            if (text !== previous.current) {
                previous.current = text
                if (text) announce(text)
            }
        }
        say()
        // Custom children can update without re-rendering this part.
        const observer = new MutationObserver(say)
        observer.observe(element, {
            childList: true,
            characterData: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-hidden', 'aria-label', 'hidden', 'alt'],
        })
        return () => observer.disconnect()
    }, [active])
    return ref
}

/** Shown while a search runs. Children replace "Searching…". */
export function FinderSearching({
    className,
    children,
    ...props
}: FinderSearchingProps) {
    const { status } = useFinderResults()
    const active = status === 'searching'
    const ref = useStatusAnnouncement(active)
    if (!active) return null
    return (
        <div
            ref={ref}
            {...props}
            data-slot="finder-searching"
            className={cn(STATE_TEXT, className)}
        >
            {children ?? (
                <>
                    <Spinner />
                    {i18n.t('Searching…')}
                </>
            )}
        </div>
    )
}

/** Shown when a search finds no one. Children replace "No one found". */
export function FinderEmpty({
    className,
    children,
    ...props
}: FinderEmptyProps) {
    const { status } = useFinderResults()
    const active = status === 'empty'
    const ref = useStatusAnnouncement(active)
    if (!active) return null
    return (
        <div
            ref={ref}
            {...props}
            data-slot="finder-empty"
            className={cn(STATE_TEXT, className)}
        >
            {children ?? i18n.t('No one found')}
        </div>
    )
}

/** Shown when a search matches more people than the program allows. */
export function FinderTooMany({
    className,
    children,
    ...props
}: FinderTooManyProps) {
    const { status } = useFinderResults()
    const active = status === 'too-many'
    const ref = useStatusAnnouncement(active)
    if (!active) return null
    return (
        <div
            ref={ref}
            {...props}
            data-slot="finder-too-many"
            className={cn(STATE_TEXT, className)}
        >
            {children ?? i18n.t('Too many matches. Add another detail.')}
        </div>
    )
}

/**
 * Shown when the search or the program's metadata could not be loaded.
 * Children replace the message.
 */
export function FinderError({
    className,
    children,
    ...props
}: FinderErrorProps) {
    const setup = useFinderModel()
    const { status } = useFinderResults()
    if (status !== 'error') {
        return null
    }
    const text = setup.isError
        ? i18n.t("The search couldn't be loaded")
        : i18n.t("The search couldn't be completed")
    return (
        <Alert
            variant="destructive"
            {...props}
            data-slot="finder-error"
            className={cn(className)}
        >
            <IconErrorFilled24 />
            <AlertTitle>{children ?? text}</AlertTitle>
        </Alert>
    )
}
