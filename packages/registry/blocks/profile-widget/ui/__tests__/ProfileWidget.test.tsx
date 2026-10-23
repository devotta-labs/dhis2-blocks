import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import {
    ProfileWidget,
    ProfileWidgetContent,
    ProfileWidgetHeader,
    ProfileWidgetHeaderActions,
    ProfileWidgetTitle,
    ProfileWidgetToggle,
    type ProfileWidgetToggleProps,
} from '../ProfileWidget'
import {
    ProfileWidgetField,
    ProfileWidgetFieldList,
    ProfileWidgetValue,
} from '../fields'

const fields = [
    { id: 'first', label: 'First name', text: 'Ingrid' },
    { id: 'last', label: 'Last name', text: 'Hansen' },
]

type FrameProps = Pick<
    React.ComponentProps<typeof ProfileWidget>,
    'defaultOpen' | 'onOpenChange'
> & {
    toggleProps?: ProfileWidgetToggleProps
}

function Frame({ defaultOpen, onOpenChange, toggleProps }: FrameProps) {
    return (
        <ProfileWidget
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange}
            data-test="profile"
        >
            <ProfileWidgetHeader>
                <ProfileWidgetTitle>Person profile</ProfileWidgetTitle>
                <ProfileWidgetHeaderActions>
                    <ProfileWidgetToggle {...toggleProps} />
                </ProfileWidgetHeaderActions>
            </ProfileWidgetHeader>
            <ProfileWidgetContent>
                <ProfileWidgetFieldList>
                    {fields.map((field) => (
                        <ProfileWidgetField key={field.id} label={field.label}>
                            <ProfileWidgetValue
                                value={{ kind: 'text', text: field.text }}
                            />
                        </ProfileWidgetField>
                    ))}
                </ProfileWidgetFieldList>
            </ProfileWidgetContent>
        </ProfileWidget>
    )
}

describe('ProfileWidget', () => {
    it('renders a labelled region with a heading, data slots and a definition list', async () => {
        const screen = await render(<Frame />)

        const region = screen.getByRole('region', { name: 'Person profile' })
        await expect.element(region).toBeVisible()
        await expect
            .element(region)
            .toHaveAttribute('data-slot', 'profile-widget')
        await expect.element(region).toHaveAttribute('data-state', 'open')
        expect(region.element().tagName).toBe('SECTION')

        const heading = screen.getByRole('heading', {
            level: 2,
            name: 'Person profile',
        })
        await expect.element(heading).toBeVisible()
        expect(region.element().getAttribute('aria-labelledby')).toBe(
            heading.element().id
        )

        const list = region.element().querySelector('dl')
        expect(list?.getAttribute('data-slot')).toBe(
            'profile-widget-field-list'
        )
        const terms = screen.getByRole('term')
        expect(terms.elements().map((term) => term.textContent)).toEqual([
            'First name:',
            'Last name:',
        ])
        expect(
            screen
                .getByRole('definition')
                .elements()
                .map((definition) => definition.textContent)
        ).toEqual(['Ingrid', 'Hansen'])
        // The trailing colon is decoration, not part of the label.
        expect(
            terms.first().element().querySelector('[aria-hidden="true"]')
                ?.textContent
        ).toBe(':')
        for (const slot of [
            'profile-widget-header',
            'profile-widget-title',
            'profile-widget-header-actions',
            'profile-widget-toggle',
            'profile-widget-content',
            'profile-widget-field',
        ]) {
            expect(
                region.element().querySelector(`[data-slot="${slot}"]`)
            ).not.toBeNull()
        }
    })

    it('collapses and expands when uncontrolled, wiring aria-expanded and aria-controls', async () => {
        const onOpenChange = vi.fn()
        const screen = await render(<Frame onOpenChange={onOpenChange} />)
        const region = screen.getByRole('region', { name: 'Person profile' })
        // Named after the widget title; aria-expanded carries the state.
        const toggle = screen.getByRole('button', { name: 'Person profile' })
        const collapse = toggle

        await expect.element(collapse).toHaveAttribute('aria-expanded', 'true')
        await expect.element(collapse).toHaveAttribute('title', 'Collapse')
        const content = region
            .element()
            .querySelector('[data-slot="profile-widget-content"]')
        expect(content?.id).toBeTruthy()
        await expect
            .element(collapse)
            .toHaveAttribute('aria-controls', content?.id)

        await collapse.click()

        const expand = toggle
        await expect.element(expand).toHaveAttribute('aria-expanded', 'false')
        await expect.element(expand).toHaveAttribute('title', 'Expand')
        await expect.element(expand).toHaveAccessibleName('Person profile')
        await expect.element(region).toHaveAttribute('data-state', 'closed')
        await expect.element(expand).toHaveAttribute('data-state', 'closed')
        await expect.element(screen.getByText('Ingrid')).not.toBeInTheDocument()
        expect(onOpenChange).toHaveBeenLastCalledWith(false)

        await expand.click()

        await expect.element(screen.getByText('Ingrid')).toBeVisible()
        await expect.element(region).toHaveAttribute('data-state', 'open')
        expect(onOpenChange).toHaveBeenLastCalledWith(true)
    })

    it('starts closed with defaultOpen false', async () => {
        const screen = await render(<Frame defaultOpen={false} />)

        await expect
            .element(screen.getByRole('button', { name: 'Person profile' }))
            .toHaveAttribute('aria-expanded', 'false')
        await expect.element(screen.getByText('Ingrid')).not.toBeInTheDocument()
    })

    it('follows the open prop when controlled', async () => {
        const onOpenChange = vi.fn()

        function Controlled() {
            const [open, setOpen] = useState(true)

            return (
                <>
                    <button type="button" onClick={() => setOpen(!open)}>
                        External toggle
                    </button>
                    <ProfileWidget
                        open={open}
                        onOpenChange={(nextOpen) => {
                            onOpenChange(nextOpen)
                            setOpen(nextOpen)
                        }}
                    >
                        <ProfileWidgetHeader>
                            <ProfileWidgetTitle>Profile</ProfileWidgetTitle>
                            <ProfileWidgetToggle />
                        </ProfileWidgetHeader>
                        <ProfileWidgetContent>Body</ProfileWidgetContent>
                    </ProfileWidget>
                </>
            )
        }

        const screen = await render(<Controlled />)

        await screen.getByRole('button', { name: 'External toggle' }).click()
        await expect.element(screen.getByText('Body')).not.toBeInTheDocument()
        const toggle = screen.getByRole('button', {
            name: 'Profile',
            exact: true,
        })
        await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(onOpenChange).not.toHaveBeenCalled()

        await toggle.click()
        await expect.element(screen.getByText('Body')).toBeVisible()
        expect(onOpenChange).toHaveBeenCalledWith(true)
    })

    // Without a title the toggle falls back to "Collapse" / "Expand".
    it('stays put when controlled and the host ignores onOpenChange', async () => {
        const onOpenChange = vi.fn()
        const screen = await render(
            <ProfileWidget open onOpenChange={onOpenChange}>
                <ProfileWidgetToggle />
                <ProfileWidgetContent>Body</ProfileWidgetContent>
            </ProfileWidget>
        )

        await screen.getByRole('button', { name: 'Collapse' }).click()

        expect(onOpenChange).toHaveBeenCalledWith(false)
        await expect.element(screen.getByText('Body')).toBeVisible()
        await expect
            .element(screen.getByRole('button', { name: 'Collapse' }))
            .toHaveAttribute('aria-expanded', 'true')
    })

    it("runs the consumer's onClick first and skips toggling when it prevents default", async () => {
        const onClick = vi.fn((event: React.MouseEvent) =>
            event.preventDefault()
        )
        const screen = await render(
            <Frame
                toggleProps={{
                    onClick,
                    collapseLabel: 'Hide profile',
                    expandLabel: 'Show profile',
                }}
            />
        )

        await screen.getByRole('button', { name: 'Hide profile' }).click()

        expect(onClick).toHaveBeenCalledOnce()
        await expect.element(screen.getByText('Ingrid')).toBeVisible()
        await expect
            .element(screen.getByRole('button', { name: 'Hide profile' }))
            .toHaveAttribute('aria-expanded', 'true')
    })

    it('renders without a toggle as a non-collapsible frame', async () => {
        const screen = await render(
            <ProfileWidget>
                <ProfileWidgetHeader>
                    <ProfileWidgetTitle>Profile</ProfileWidgetTitle>
                </ProfileWidgetHeader>
                <ProfileWidgetContent>Body</ProfileWidgetContent>
            </ProfileWidget>
        )

        await expect.element(screen.getByText('Body')).toBeVisible()
        expect(screen.container.querySelector('button')).toBeNull()
    })

    it('labels the region from a custom title element and id', async () => {
        const screen = await render(
            <ProfileWidget>
                <ProfileWidgetTitle id="custom-title" render={<h3 />}>
                    Ingrid Hansen
                </ProfileWidgetTitle>
            </ProfileWidget>
        )

        const heading = screen.getByRole('heading', {
            level: 3,
            name: 'Ingrid Hansen',
        })
        await expect.element(heading).toHaveAttribute('id', 'custom-title')
        await expect
            .element(screen.getByRole('region', { name: 'Ingrid Hansen' }))
            .toHaveAttribute('aria-labelledby', 'custom-title')
    })

    it('leaves aria-labelledby off without a title and lets the host label or re-tag the frame', async () => {
        const screen = await render(
            <>
                <ProfileWidget data-test="untitled">
                    <ProfileWidgetContent>Untitled body</ProfileWidgetContent>
                </ProfileWidget>
                <ProfileWidget aria-label="Visit" render={<article />}>
                    <ProfileWidgetContent>Article body</ProfileWidgetContent>
                </ProfileWidget>
            </>
        )

        await expect.element(screen.getByText('Untitled body')).toBeVisible()
        const untitled = screen.container.querySelector(
            '[data-test="untitled"]'
        )
        expect(untitled?.hasAttribute('aria-labelledby')).toBe(false)
        await expect
            .element(screen.getByRole('article', { name: 'Visit' }))
            .toHaveAttribute('data-slot', 'profile-widget')
    })

    it('forwards refs and merges class names', async () => {
        const frameRef = React.createRef<HTMLElement>()
        const titleRef = React.createRef<HTMLHeadingElement>()
        const toggleRef = React.createRef<HTMLButtonElement>()
        const contentRef = React.createRef<HTMLDivElement>()
        const fieldRef = React.createRef<HTMLDivElement>()
        const screen = await render(
            <ProfileWidget ref={frameRef} className="custom-frame">
                <ProfileWidgetTitle ref={titleRef}>Profile</ProfileWidgetTitle>
                <ProfileWidgetToggle ref={toggleRef} />
                <ProfileWidgetContent ref={contentRef} className="custom-body">
                    <ProfileWidgetFieldList>
                        <ProfileWidgetField ref={fieldRef} label="Name" />
                    </ProfileWidgetFieldList>
                </ProfileWidgetContent>
            </ProfileWidget>
        )

        await expect.element(screen.getByText('Profile')).toBeVisible()
        expect(frameRef.current?.tagName).toBe('SECTION')
        expect(frameRef.current?.classList.contains('custom-frame')).toBe(true)
        expect(titleRef.current?.tagName).toBe('H2')
        expect(toggleRef.current?.tagName).toBe('BUTTON')
        expect(contentRef.current?.classList.contains('custom-body')).toBe(true)
        expect(fieldRef.current?.getAttribute('data-slot')).toBe(
            'profile-widget-field'
        )
    })

    it('uses Capture widget metrics for the label column', async () => {
        const screen = await render(<Frame />)

        const term = screen.getByRole('term').first()
        await expect.element(term).toBeVisible()
        expect(getComputedStyle(term.element()).width).toBe('110px')
    })
})
