import axe from 'axe-core'
import React, { useState } from 'react'
import { MemoryRouter, NavLink, useLocation } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    Sidebar,
    SidebarButton,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupTrigger,
    SidebarHeader,
    SidebarItem,
    SidebarItems,
    SidebarLink,
    SidebarNavigation,
    SidebarToggle,
    useSidebar,
} from '../index'

function Navigation() {
    return (
        <SidebarNavigation aria-label="Modeling">
            <SidebarHeader>Modeling</SidebarHeader>
            <SidebarContent>
                <SidebarItems>
                    <SidebarItem>
                        <SidebarLink href="#dashboard" aria-current="page">
                            Dashboard
                        </SidebarLink>
                    </SidebarItem>
                    <SidebarGroup defaultOpen>
                        <SidebarGroupTrigger>Evaluate</SidebarGroupTrigger>
                        <SidebarGroupContent>
                            <SidebarItem>
                                <SidebarLink href="#compare">
                                    Compare
                                </SidebarLink>
                            </SidebarItem>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarItems>
            </SidebarContent>
            <SidebarFooter>
                <SidebarItems>
                    <SidebarItem>
                        <SidebarButton disabled>Report a bug</SidebarButton>
                    </SidebarItem>
                </SidebarItems>
            </SidebarFooter>
        </SidebarNavigation>
    )
}

afterEach(async () => {
    await page.viewport(1024, 768)
})

test('nested groups and collapse preserve state and keep hidden links out of keyboard navigation', async () => {
    const onCollapsedChange = vi.fn()
    await render(
        <Sidebar onCollapsedChange={onCollapsedChange}>
            <Navigation />
            <SidebarToggle />
        </Sidebar>
    )
    const group = page.getByRole('button', { name: 'Evaluate', exact: true })
    await expect.element(group).toHaveAttribute('aria-expanded', 'true')
    await group.click()
    await expect
        .element(page.getByRole('link', { name: 'Compare' }))
        .not.toBeInTheDocument()
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true)
    expect(document.querySelector('nav')).not.toBeVisible()
    const expand = page.getByRole('button', { name: 'Expand sidebar' })
    await expect.element(expand).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard('{Tab}')
    expect(document.activeElement?.closest('nav')).toBeNull()
    await expand.click()
    await expect.element(group).toHaveAttribute('aria-expanded', 'false')
    group.element().focus()
    await userEvent.keyboard('{Enter}')
    await expect
        .element(page.getByRole('link', { name: 'Compare' }))
        .toBeVisible()
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false)
})

test('controlled collapse follows its parent and a cancelled click does not toggle', async () => {
    const change = vi.fn()
    const view = await render(
        <Sidebar collapsed={false} onCollapsedChange={change}>
            <Navigation />
            <SidebarToggle />
        </Sidebar>
    )
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    expect(change).toHaveBeenCalledWith(true)
    await expect.element(page.getByRole('navigation')).toBeVisible()
    await view.rerender(
        <Sidebar collapsed onCollapsedChange={change}>
            <Navigation />
            <SidebarToggle onClick={(event) => event.preventDefault()} />
        </Sidebar>
    )
    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    expect(change).toHaveBeenCalledTimes(1)
    expect(document.querySelector('nav')).not.toBeVisible()
})

function CustomToggle() {
    const { state, actions, meta } = useSidebar()
    return (
        <button
            type="button"
            aria-controls={meta.navigationId}
            aria-expanded={!state.collapsed}
            onClick={() => actions.setCollapsed(!state.collapsed)}
        >
            Toggle navigation
        </button>
    )
}

test('defaultCollapsed and custom controls share the public context', async () => {
    await render(
        <Sidebar defaultCollapsed>
            <Navigation />
            <CustomToggle />
        </Sidebar>
    )
    expect(document.querySelector('nav')).not.toBeVisible()
    const toggle = page.getByRole('button', { name: 'Toggle navigation' })
    await toggle.click()
    await expect.element(page.getByRole('navigation')).toBeVisible()
    expect(toggle.element().getAttribute('aria-controls')).toBe(
        page.getByRole('navigation').element().id
    )
})

function RouteLocation() {
    const location = useLocation()
    return <output aria-label="Current route">{location.pathname}</output>
}

test('router links keep anchor semantics, navigation and theme-based active styling', async () => {
    const onClick = vi.fn()
    const { container } = await render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <Sidebar>
                <SidebarNavigation>
                    <SidebarItems>
                        <SidebarItem>
                            <SidebarLink
                                render={<NavLink to="/dashboard" end />}
                            >
                                Dashboard
                            </SidebarLink>
                        </SidebarItem>
                        <SidebarItem>
                            <SidebarLink
                                render={<NavLink to="/datasets" />}
                                onClick={onClick}
                            >
                                Datasets
                            </SidebarLink>
                        </SidebarItem>
                    </SidebarItems>
                </SidebarNavigation>
            </Sidebar>
            <RouteLocation />
        </MemoryRouter>
    )
    const datasets = page.getByRole('link', { name: 'Datasets' })
    await datasets.click()
    await expect.element(datasets).toHaveAttribute('aria-current', 'page')
    await expect
        .element(page.getByRole('link', { name: 'Dashboard' }))
        .not.toHaveAttribute('aria-current')
    await expect
        .element(page.getByRole('status', { name: 'Current route' }))
        .toHaveTextContent('/datasets')
    expect(onClick).toHaveBeenCalledOnce()
    expect(container.querySelectorAll('a')).toHaveLength(2)
    expect(
        getComputedStyle(datasets.element(), '::before').backgroundColor
    ).toBe('rgb(0, 150, 136)')
    expect(getComputedStyle(datasets.element()).backgroundColor).toBe(
        'rgb(64, 75, 90)'
    )
})

test('controlled groups and native buttons support keyboard interaction and disabled state', async () => {
    const action = vi.fn()
    function ControlledGroup() {
        const [open, setOpen] = useState(false)
        return (
            <Sidebar>
                <SidebarNavigation>
                    <SidebarItems>
                        <SidebarGroup open={open} onOpenChange={setOpen}>
                            <SidebarGroupTrigger>Evaluate</SidebarGroupTrigger>
                            <SidebarGroupContent>
                                <SidebarItem>
                                    <SidebarButton onClick={action}>
                                        Run evaluation
                                    </SidebarButton>
                                </SidebarItem>
                                <SidebarItem>
                                    <SidebarButton disabled onClick={action}>
                                        Unavailable
                                    </SidebarButton>
                                </SidebarItem>
                            </SidebarGroupContent>
                        </SidebarGroup>
                        <SidebarGroup disabled>
                            <SidebarGroupTrigger>
                                Disabled group
                            </SidebarGroupTrigger>
                        </SidebarGroup>
                    </SidebarItems>
                </SidebarNavigation>
            </Sidebar>
        )
    }
    await render(<ControlledGroup />)
    const trigger = page.getByRole('button', { name: 'Evaluate', exact: true })
    trigger.element().focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('button', { name: 'Run evaluation' }).click()
    expect(action).toHaveBeenCalledOnce()
    await expect
        .element(page.getByRole('button', { name: 'Unavailable' }))
        .toBeDisabled()
    await expect
        .element(page.getByRole('button', { name: 'Disabled group' }))
        .toBeDisabled()
})

test('desktop rail, mobile bar and RTL marker retain accessible navigation', async () => {
    await page.viewport(1024, 768)
    const { container } = await render(
        <Sidebar dir="rtl" className="md:h-96">
            <Navigation />
            <SidebarToggle />
        </Sidebar>
    )
    const sidebar = page.getByRole('complementary').element()
    expect(sidebar.getBoundingClientRect().width).toBe(240)
    const link = page.getByRole('link', { name: 'Dashboard' })
    expect(getComputedStyle(link.element(), '::before').right).toBe('0px')
    expect((await axe.run(container)).violations).toEqual([])
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect.poll(() => sidebar.getBoundingClientRect().width).toBe(52)
    await page.viewport(390, 844)
    expect(sidebar.getBoundingClientRect().height).toBe(52)
    await expect
        .poll(() => sidebar.getBoundingClientRect().width)
        .toBe(container.getBoundingClientRect().width)
    expect(document.querySelector('nav')).not.toBeVisible()
    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect
        .element(page.getByRole('link', { name: 'Dashboard' }))
        .toBeVisible()
    await userEvent.keyboard('{Tab}')
    link.element().focus()
    expect(getComputedStyle(link.element()).outlineWidth).toBe('2px')
})
