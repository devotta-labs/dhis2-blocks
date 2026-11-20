import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { OrgUnitSwitcherFixture } from './OrgUnitSwitcherFixture'

describe('organisation unit switcher in forced colours', () => {
    beforeEach(() => localStorage.clear())

    it('runs with forced colours active', () => {
        expect(matchMedia('(forced-colors: active)').matches).toBe(true)
    })

    it('outlines the focused trigger', async () => {
        await render(<OrgUnitSwitcherFixture />)
        const trigger = page.getByRole('button', {
            name: 'Organisation unit: Bristol Clinic',
        })
        await expect.element(trigger).toBeVisible()
        await userEvent.tab()

        const style = getComputedStyle(trigger.element())
        expect(trigger.element()).toHaveFocus()
        expect(style.outlineStyle).toBe('solid')
        expect(style.outlineWidth).not.toBe('0px')
    })

    it('marks the current unit with a check, not a background', async () => {
        await render(<OrgUnitSwitcherFixture />)
        const trigger = page.getByRole('button', {
            name: 'Organisation unit: Bristol Clinic',
        })
        await expect.element(trigger).toBeVisible()
        await trigger.click()

        const current = page.getByRole('menuitemradio', {
            name: 'Bristol Clinic',
        })
        await expect.element(current).toHaveAttribute('aria-checked', 'true')

        expect(current.element().querySelectorAll('svg')).toHaveLength(1)

        const other = page
            .getByRole('menuitemradio', { name: 'Ocean Beach Clinic' })
            .element()
        expect(other.querySelectorAll('svg')).toHaveLength(0)
    })
})
