import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { roleColour } from '../../../test/roleColour'
import {
    Pane,
    PaneActions,
    PaneContent,
    PaneGroup,
    PaneHandle,
    PaneHeader,
    PaneTitle,
    Section,
    SectionContent,
    SectionTrigger,
    Toolbar,
    ToolbarButton,
} from '..'

const box = (testId: string) =>
    page.getByTestId(testId).element().getBoundingClientRect()

const App = () => (
    <div style={{ width: 1200, height: 400 }}>
        <PaneGroup>
            <Pane
                defaultSize={264}
                maxSize={400}
                collapsible
                aria-label="Lists"
                data-testid="navigator"
            >
                <PaneHeader title="Lists" />
                <Toolbar aria-label="Compact">
                    <ToolbarButton data-testid="compact-button">
                        Add
                    </ToolbarButton>
                </Toolbar>
                <PaneContent>Antenatal care</PaneContent>
            </Pane>
            <PaneHandle aria-label="Resize lists" />
            <Pane minSize={300} data-testid="middle">
                <PaneGroup orientation="vertical">
                    <Pane density="comfortable" data-testid="canvas">
                        <Toolbar aria-label="Comfortable">
                            <ToolbarButton data-testid="comfortable-button">
                                Add
                            </ToolbarButton>
                        </Toolbar>
                    </Pane>
                    <Pane side="end" defaultSize={120} data-testid="bottom" />
                </PaneGroup>
            </Pane>
            <Pane
                side="end"
                defaultSize={304}
                collapsible
                aria-label="Selection"
                data-testid="inspector"
            >
                <PaneHeader title="Selection" />
            </Pane>
        </PaneGroup>
    </div>
)

/** The pane's own surface: the element its class and borders are on. */
const surface = (testId: string) => {
    const element = page.getByTestId(testId).element().firstElementChild
    if (!element) throw new Error(`No surface in ${testId}`)
    return getComputedStyle(element)
}

describe('PaneGroup', () => {
    it('docks nested panes edge to edge, one hairline apart, with no shadow', async () => {
        await render(<App />)
        await expect.poll(() => box('navigator').width).toBe(264)
        const [navigator, middle, canvas, bottom, inspector] = [
            box('navigator'),
            box('middle'),
            box('canvas'),
            box('bottom'),
            box('inspector'),
        ]
        expect(inspector.width).toBe(304)
        expect(middle.left).toBe(navigator.right)
        expect(inspector.left).toBe(middle.right)
        expect(middle.height).toBe(400)
        expect(bottom.height).toBe(120)
        expect(bottom.top).toBe(canvas.bottom)
        expect(surface('navigator').borderInlineStartWidth).toBe('0px')
        expect(surface('middle').borderInlineStartWidth).toBe('1px')
        expect(surface('bottom').borderTopWidth).toBe('1px')
        expect(surface('middle').borderInlineStartColor).toBe(
            roleColour('border-strong')
        )
        expect(surface('middle').boxShadow).toBe('none')
        expect(surface('middle').borderRadius).toBe('0px')
    })

    it("sizes a pane's content by the pane's own density", async () => {
        await render(<App />)
        expect(box('compact-button').height).toBe(30)
        expect(box('comfortable-button').height).toBe(40)
    })

    it('resizes from the keyboard, within every pane’s limits', async () => {
        await render(<App />)
        await expect.poll(() => box('navigator').width).toBe(264)
        const handle = page.getByRole('separator', { name: 'Resize lists' })
        handle.element().focus()
        await userEvent.keyboard('{ArrowRight}')
        await expect.poll(() => box('navigator').width).toBeGreaterThan(264)
        await userEvent.keyboard('{End}')
        await expect.poll(() => box('navigator').width).toBe(400)
        expect(box('middle').width).toBeGreaterThanOrEqual(300)
    })
})

describe('a collapsible Pane', () => {
    it('folds to a rail from its header and opens again', async () => {
        await render(<App />)
        const toggle = page.getByRole('button', { name: 'Lists' })
        await expect.element(toggle).toHaveAttribute('aria-expanded', 'true')
        await toggle.click()
        await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
        await expect.element(page.getByText('Antenatal care')).not.toBeVisible()
        await expect
            .element(page.getByTestId('compact-button'))
            .not.toBeVisible()
        expect(box('navigator').width).toBe(40)
        expect(box('middle').left).toBe(box('navigator').right)
        await userEvent.keyboard('{Enter}')
        await expect.element(page.getByText('Antenatal care')).toBeVisible()
        expect(box('navigator').width).toBe(264)
    })

    it('hides a nested collapsible pane along with the rest of its content', async () => {
        await render(
            <div style={{ width: 800, height: 300 }}>
                <PaneGroup>
                    <Pane defaultSize={400} collapsible data-testid="outer">
                        <PaneHeader title="Outer" />
                        <PaneContent>
                            <PaneGroup orientation="vertical">
                                <Pane collapsible>
                                    <PaneHeader title="Inner" />
                                </Pane>
                                <Pane />
                            </PaneGroup>
                        </PaneContent>
                    </Pane>
                    <Pane />
                </PaneGroup>
            </div>
        )
        const inner = page.getByRole('heading', { name: 'Inner' })
        await expect.element(inner).toBeVisible()
        await page.getByRole('button', { name: 'Outer' }).click()
        // Hidden content leaves the accessibility tree, so the role finds nothing.
        await expect.element(inner).not.toBeInTheDocument()
        expect(box('outer').width).toBe(40)
    })

    it('hides everything but its button when its header is wrapped', async () => {
        await render(
            <div style={{ width: 800, height: 300 }}>
                <PaneGroup>
                    <Pane defaultSize={300} collapsible data-testid="notes">
                        <div>
                            <div>
                                <PaneHeader title="Notes" />
                                <button type="button">Delete</button>
                            </div>
                        </div>
                    </Pane>
                    <Pane />
                </PaneGroup>
            </div>
        )
        await page.getByRole('button', { name: 'Notes' }).click()
        await expect.poll(() => box('notes').width).toBe(40)
        await expect
            .element(page.getByRole('button', { name: 'Delete' }))
            .not.toBeInTheDocument()
        // Hidden, Delete is out of the tab order too.
        await userEvent.keyboard('{Tab}')
        expect(document.activeElement?.textContent).not.toBe('Delete')
        await page.getByRole('button', { name: 'Notes' }).click()
        await expect.poll(() => box('notes').width).toBe(300)
        await expect
            .element(page.getByRole('button', { name: 'Delete' }))
            .toBeVisible()
    })

    it('does not scroll itself: only its content does', async () => {
        await render(<App />)
        expect(surface('navigator').overflowY).toBe('hidden')
    })

    it('keeps a button to open it when it has no header', async () => {
        await render(
            <div style={{ width: 800, height: 300 }}>
                <PaneGroup>
                    <Pane
                        defaultSize={300}
                        collapsible
                        aria-label="Notes"
                        data-testid="notes"
                    >
                        <PaneContent>Nothing yet</PaneContent>
                    </Pane>
                    <PaneHandle aria-label="Resize notes" />
                    <Pane />
                </PaneGroup>
            </div>
        )
        await expect.poll(() => box('notes').width).toBe(300)
        // No header, so no button while it is open; the keyboard folds it.
        page.getByRole('separator', { name: 'Resize notes' }).element().focus()
        await userEvent.keyboard('{Home}')
        const open = page.getByRole('button', { name: 'Notes' })
        await expect.element(open).toHaveAttribute('aria-expanded', 'false')
        expect(box('notes').width).toBe(40)
        await open.click()
        await expect.element(page.getByText('Nothing yet')).toBeVisible()
    })

    it('puts its button, and the marked side of its icon, toward the other panes', async () => {
        await render(<App />)
        const button = (name: string) =>
            page.getByRole('button', { name }).element()
        const heading = (name: string) =>
            page.getByRole('heading', { name }).element()
        const line = (name: string) =>
            button(name).querySelector('path')?.getAttribute('d')
        // A start pane's button follows its title; an end pane's leads it.
        expect(
            heading('Lists').compareDocumentPosition(button('Lists')) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
        expect(
            heading('Selection').compareDocumentPosition(button('Selection')) &
                Node.DOCUMENT_POSITION_PRECEDING
        ).toBeTruthy()
        expect(line('Lists')).toBe('M9 3v18')
        expect(line('Selection')).toBe('M15 3v18')
    })
})

describe('Pane', () => {
    it('scrolls its content under its header and toolbar, which stay put', async () => {
        await render(
            <Pane style={{ height: 200 }} data-testid="pane">
                <PaneHeader title="Visits" data-testid="header" />
                <Toolbar aria-label="Actions" data-testid="toolbar">
                    <ToolbarButton>Add</ToolbarButton>
                </Toolbar>
                <PaneContent data-testid="content">
                    <div style={{ height: 1000 }} data-testid="tall" />
                </PaneContent>
            </Pane>
        )
        const scroller = page.getByTestId('content').element()
        expect(box('content').top).toBe(box('toolbar').bottom)
        // A pane on its own has a 1px edge.
        expect(box('content').bottom).toBe(box('pane').bottom - 1)
        scroller.scrollTop = 300
        expect(box('header').top).toBe(box('pane').top + 1)
        expect(box('tall').top).toBeLessThan(box('pane').top)
    })
})

describe('Pane', () => {
    it('has an edge of its own outside a group', async () => {
        await render(<Pane data-testid="alone">Content</Pane>)
        const style = getComputedStyle(page.getByTestId('alone').element())
        expect(style.borderTopWidth).toBe('1px')
        expect(style.borderTopColor).toBe(roleColour('border-strong'))
        expect(style.boxShadow).toBe('none')
        expect(style.borderRadius).toBe('0px')
    })

    it('keeps a pixel size given as a string when its group resizes', async () => {
        const Sized = ({ width }: { width: number }) => (
            <div style={{ width, height: 200 }}>
                <PaneGroup>
                    <Pane defaultSize="200px" data-testid="fixed" />
                    <Pane />
                </PaneGroup>
            </div>
        )
        const screen = await render(<Sized width={800} />)
        await expect.poll(() => box('fixed').width).toBe(200)
        await screen.rerender(<Sized width={1200} />)
        // Kept in proportion it would be 300; the library rounds to a pixel.
        await expect
            .poll(() => Math.abs(box('fixed').width - 200))
            .toBeLessThanOrEqual(1)
    })
})

describe('the parts inside a primitive', () => {
    it('each have a data-slot to style them by', async () => {
        const screen = await render(
            <PaneGroup>
                <Pane collapsible>
                    <PaneHeader title="Lists">
                        <button type="button">Add</button>
                    </PaneHeader>
                    <Section title="Programmes" meta="4">
                        Antenatal care
                    </Section>
                </Pane>
                <Pane />
            </PaneGroup>
        )
        const slots = [
            ...screen.container.querySelectorAll(
                '[data-slot=pane-header] [data-slot], [data-slot=section] [data-slot]'
            ),
        ].map((part) => part.getAttribute('data-slot'))
        expect(slots).toEqual([
            'pane-title',
            'pane-actions',
            'pane-toggle',
            'section-heading',
            'section-trigger',
            'section-indicator',
            'section-title',
            'section-meta',
            'section-content',
        ])
    })
})

describe('a primitive composed from its parts', () => {
    it('lays out a header from a title, a count and actions, and folds to its button', async () => {
        await render(
            <div style={{ width: 800, height: 300 }}>
                <PaneGroup>
                    <Pane defaultSize={300} collapsible data-testid="lists">
                        <PaneHeader>
                            <PaneTitle>Lists</PaneTitle>
                            <span>12 open</span>
                            <PaneActions>
                                <button type="button">Add</button>
                            </PaneActions>
                        </PaneHeader>
                    </Pane>
                    <Pane />
                </PaneGroup>
            </div>
        )
        await expect.element(page.getByText('12 open')).toBeVisible()
        // The title names the collapse button.
        await page.getByRole('button', { name: 'Lists' }).click()
        await expect.poll(() => box('lists').width).toBe(40)
        await expect.element(page.getByText('12 open')).not.toBeVisible()
        await expect
            .element(page.getByRole('button', { name: 'Add' }))
            .not.toBeInTheDocument()
        await expect
            .element(page.getByRole('button', { name: 'Lists' }))
            .toBeVisible()
    })

    it('opens and closes a section from a trigger holding anything', async () => {
        await render(
            <Pane>
                <Section>
                    <SectionTrigger>
                        Programmes <span>4 of 9</span>
                    </SectionTrigger>
                    <SectionContent>Antenatal care</SectionContent>
                </Section>
            </Pane>
        )
        const trigger = page.getByRole('button', {
            name: 'Programmes 4 of 9',
        })
        await expect
            .element(page.getByRole('heading', { level: 3 }))
            .toHaveTextContent('Programmes 4 of 9')
        await expect.element(page.getByText('Antenatal care')).toBeVisible()
        await trigger.click()
        await expect
            .element(page.getByText('Antenatal care'))
            .not.toBeInTheDocument()
    })
})

describe('Section', () => {
    it('opens and closes from the keyboard and says which it is', async () => {
        await render(
            <Pane>
                <Section title="Allergies">None recorded</Section>
            </Pane>
        )
        const trigger = page.getByRole('button', { name: 'Allergies' })
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
        await expect.element(page.getByText('None recorded')).toBeVisible()
        await userEvent.tab()
        expect(document.activeElement).toBe(trigger.element())
        await userEvent.keyboard('{Enter}')
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
        await expect
            .element(page.getByText('None recorded'))
            .not.toBeInTheDocument()
        await userEvent.keyboard(' ')
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
    })

    it('takes its heading level from the sections around it, or a prop', async () => {
        await render(
            <Pane>
                <Section title="Outer">
                    <Section title="Inner">Content</Section>
                </Section>
                <Section title="Top" level={2}>
                    Content
                </Section>
            </Pane>
        )
        const level = (name: string) =>
            page.getByRole('heading', { name }).element().tagName
        expect(level('Outer')).toBe('H3')
        expect(level('Inner')).toBe('H4')
        expect(level('Top')).toBe('H2')
    })
})
