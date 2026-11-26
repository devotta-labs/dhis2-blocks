import React from 'react'
import { render } from 'vitest-browser-react'
import {
    useVisitViewer,
    VisitDate,
    VisitFact,
    VisitFactLabel,
    VisitFacts,
    VisitFactValue,
    VisitItem,
    VisitItemActions,
    VisitItemBody,
    VisitItemHeader,
    VisitItemTitle,
    VisitList,
    VisitMeta,
    VisitNote,
    VisitNoteMeta,
    VisitNotes,
    VisitNoteText,
    VisitService,
    VisitServices,
    VisitStatus,
    VisitViewer,
    VisitViewerActions,
    VisitViewerDescription,
    VisitViewerEmpty,
    VisitViewerGroup,
    VisitViewerGroupLabel,
    VisitViewerHeader,
    VisitViewerTitle,
    VisitViewerToolbar,
} from '..'

const slot = (container: HTMLElement, name: string) =>
    container.querySelector(`[data-slot="${name}"]`)

const Settings = () => {
    const { calendar, locale } = useVisitViewer()
    return <span data-testid="settings">{`${calendar} ${locale ?? '-'}`}</span>
}

describe('visit viewer composition', () => {
    it('names the view and each group after their headings', async () => {
        const screen = await render(
            <VisitViewer>
                <VisitViewerHeader>
                    <VisitViewerTitle>Visits</VisitViewerTitle>
                    <VisitViewerDescription>
                        Child health
                    </VisitViewerDescription>
                    <VisitViewerActions>
                        <button type="button">New visit</button>
                    </VisitViewerActions>
                </VisitViewerHeader>
                <VisitViewerGroup>
                    <VisitViewerGroupLabel>Upcoming</VisitViewerGroupLabel>
                    <VisitList />
                </VisitViewerGroup>
            </VisitViewer>
        )
        await expect
            .element(screen.getByRole('region', { name: 'Visits' }))
            .toBeInTheDocument()
        await expect
            .element(screen.getByRole('region', { name: 'Upcoming' }))
            .toBeInTheDocument()
        await expect
            .element(screen.getByRole('heading', { level: 2, name: 'Visits' }))
            .toBeInTheDocument()
        await expect
            .element(
                screen.getByRole('heading', { level: 3, name: 'Upcoming' })
            )
            .toBeInTheDocument()
    })

    it('leaves a section unnamed without a heading, and lets you name it', async () => {
        const screen = await render(
            <>
                <VisitViewer data-testid="plain" />
                <VisitViewer aria-label="Past visits" />
            </>
        )
        expect(
            screen
                .getByTestId('plain')
                .element()
                .hasAttribute('aria-labelledby')
        ).toBe(false)
        await expect
            .element(screen.getByRole('region', { name: 'Past visits' }))
            .toBeInTheDocument()
    })

    it('renders semantic, slotted parts that forward props and classes', async () => {
        const screen = await render(
            <VisitViewer className="custom-root" data-consumer="root">
                <VisitViewerToolbar aria-label="Filters" />
                <VisitList className="custom-list">
                    <VisitItem status="skipped" id="visit-1">
                        <VisitItemHeader>
                            <VisitItemTitle level={3}>
                                Child visit
                            </VisitItemTitle>
                            <VisitDate value="2026-11-12" locale="en" />
                            <VisitStatus variant="skipped" />
                            <VisitItemActions>
                                <button type="button">Open</button>
                            </VisitItemActions>
                        </VisitItemHeader>
                        <VisitItemBody>
                            <VisitServices>
                                <VisitService>Vaccination</VisitService>
                                <VisitService status="skipped">
                                    Growth monitoring
                                </VisitService>
                            </VisitServices>
                            <VisitMeta>
                                <span>Ngelehun CHC</span>
                                <span>Nurse Amina</span>
                                <span>14:30</span>
                            </VisitMeta>
                            <VisitFacts>
                                <VisitFact>
                                    <VisitFactLabel>Weight</VisitFactLabel>
                                    <VisitFactValue>7.4 kg</VisitFactValue>
                                </VisitFact>
                            </VisitFacts>
                            <VisitNotes>
                                <VisitNote>
                                    <VisitNoteMeta>
                                        <span>Nurse Amina</span>
                                    </VisitNoteMeta>
                                    <VisitNoteText>
                                        Mother asked about BCG.
                                    </VisitNoteText>
                                </VisitNote>
                            </VisitNotes>
                        </VisitItemBody>
                    </VisitItem>
                </VisitList>
            </VisitViewer>
        )
        const { container } = screen
        const root = slot(container, 'visit-viewer')
        expect(root?.tagName).toBe('SECTION')
        expect(root).toHaveClass('custom-root')
        expect(root?.getAttribute('data-consumer')).toBe('root')
        expect(slot(container, 'visit-list')?.tagName).toBe('OL')
        expect(slot(container, 'visit-list')).toHaveClass('custom-list')
        const item = slot(container, 'visit-item')
        expect(item?.tagName).toBe('LI')
        expect(item?.id).toBe('visit-1')
        expect(item?.getAttribute('data-status')).toBe('skipped')
        expect(slot(container, 'visit-item-title')?.tagName).toBe('H3')
        expect(slot(container, 'visit-services')?.tagName).toBe('UL')
        expect(
            container.querySelectorAll('[data-slot="visit-services"] > li')
        ).toHaveLength(2)
        expect(slot(container, 'visit-facts')?.tagName).toBe('DL')
        expect(slot(container, 'visit-fact-label')?.tagName).toBe('DT')
        expect(slot(container, 'visit-notes')?.tagName).toBe('UL')
        expect(slot(container, 'visit-note')?.tagName).toBe('LI')
        for (const list of ['visit-list', 'visit-services', 'visit-notes']) {
            expect(slot(container, list)).toHaveAttribute('role', 'list')
        }
        expect(slot(container, 'visit-note-text')).toHaveTextContent(
            'Mother asked about BCG.'
        )
        expect(slot(container, 'visit-viewer-toolbar')).toHaveAttribute(
            'aria-label',
            'Filters'
        )
        await expect
            .element(screen.getByText('Skipped', { exact: true }).first())
            .toBeVisible()
    })

    it('puts a dot between meta parts and hides an empty meta line', async () => {
        const screen = await render(
            <>
                <VisitMeta data-testid="meta">
                    <span>Ngelehun CHC</span>
                    <span>Nurse Amina</span>
                </VisitMeta>
                <VisitMeta data-testid="empty" />
            </>
        )
        const first = screen.getByTestId('meta').element().firstElementChild
        expect(
            first === null ? '' : getComputedStyle(first, '::after').content
        ).toBe('"·"')
        const last = screen.getByTestId('meta').element().lastElementChild
        expect(
            last === null ? '' : getComputedStyle(last, '::after').content
        ).toBe('none')
        await expect.element(screen.getByTestId('empty')).not.toBeVisible()
    })

    it('shows your empty state copy and actions', async () => {
        const screen = await render(
            <VisitViewerEmpty>
                <p>No visits yet</p>
                <button type="button">Schedule a visit</button>
            </VisitViewerEmpty>
        )
        await expect.element(screen.getByText('No visits yet')).toBeVisible()
        await expect
            .element(screen.getByRole('button', { name: 'Schedule a visit' }))
            .toBeVisible()
    })

    it('shares the calendar and locale, with safe defaults outside a viewer', async () => {
        const screen = await render(
            <>
                <div data-testid="outside">
                    <Settings />
                </div>
                <VisitViewer calendar="ethiopian" locale="am">
                    <Settings />
                </VisitViewer>
            </>
        )
        await expect
            .element(screen.getByTestId('outside'))
            .toHaveTextContent('gregorian -')
        await expect
            .element(screen.getByText('ethiopian am'))
            .toBeInTheDocument()
    })
})
