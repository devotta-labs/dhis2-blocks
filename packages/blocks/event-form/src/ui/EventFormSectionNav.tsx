import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/registry/dhis2/ui/button'
import { cn } from '@/registry/dhis2/ui/cn'
import {
    useEventFormInternal,
    useSectionModels,
} from './EventForm/EventFormContext'
import { useEventFormText } from './EventFormText'

/** The section whose heading is nearest the top of the viewport, among those on screen. */
const useActiveSection = (headingIds: readonly string[]) => {
    const [active, setActive] = useState<string>()
    const key = headingIds.join(' ')
    useEffect(() => {
        const ids = key === '' ? [] : key.split(' ')
        const sections = ids.flatMap((id) => {
            const section = document.getElementById(id)?.parentElement
            return section ? [{ id, section }] : []
        })
        if (sections.length === 0) {
            return undefined
        }
        const onScreen = new Set<string>()
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const match = sections.find(
                        ({ section }) => section === entry.target
                    )
                    if (match === undefined) {
                        continue
                    }
                    if (entry.isIntersecting) {
                        onScreen.add(match.id)
                    } else {
                        onScreen.delete(match.id)
                    }
                }
                const first = ids.find((id) => onScreen.has(id))
                if (first !== undefined) {
                    setActive(first)
                }
            },
            { rootMargin: '0px 0px -50% 0px' }
        )
        sections.forEach(({ section }) => observer.observe(section))
        return () => observer.disconnect()
    }, [key])
    return active
}

/**
 * A sticky list of the visible sections, for the host to place beside or above the form. It
 * follows the section being read, and picking one moves focus to its heading. Renders nothing
 * when fewer than two sections are visible.
 */
export const EventFormSectionNav = ({ className }: { className?: string }) => {
    const translate = useEventFormText()
    const sections = useSectionModels()
    const { sectionHeadingId } = useEventFormInternal('EventFormSectionNav')
    const visible = useMemo(
        () =>
            sections.filter(
                (section) => !section.hidden && section.fieldIds.length > 0
            ),
        [sections]
    )
    const headingIds = useMemo(
        () => visible.map((section) => sectionHeadingId(section.id)),
        [visible, sectionHeadingId]
    )
    const active = useActiveSection(headingIds)
    if (visible.length < 2) {
        return null
    }
    return (
        <nav
            aria-label={translate('Sections')}
            className={cn(
                'sticky top-0 z-10 bg-dhis2-grey-100 py-2',
                className
            )}
        >
            <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
                {visible.map((section, index) => {
                    const headingId = headingIds[index]
                    const current = headingId === active
                    return (
                        <li key={section.id}>
                            <Button
                                type="button"
                                variant={current ? 'secondary' : 'ghost'}
                                size="sm"
                                aria-current={current ? 'location' : undefined}
                                onClick={() => {
                                    const heading =
                                        document.getElementById(headingId)
                                    heading?.scrollIntoView({ block: 'start' })
                                    heading?.focus({ preventScroll: true })
                                }}
                            >
                                {section.name}
                            </Button>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
