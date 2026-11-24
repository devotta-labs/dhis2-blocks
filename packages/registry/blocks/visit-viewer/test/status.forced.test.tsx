import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { partOf, Statuses, VARIANTS } from './status.fixture'

const canvas = () =>
    getComputedStyle(page.getByTestId('canvas').element()).backgroundColor

describe('visit statuses in forced colours', () => {
    it('runs with forced colours active', () => {
        expect(matchMedia('(forced-colors: active)').matches).toBe(true)
    })

    it.each(VARIANTS)(
        'outlines a %s badge and keeps its icon and words',
        async (variant) => {
            await render(<Statuses />)
            const badge = page.getByTestId(variant).element()
            const style = getComputedStyle(badge)
            expect(style.borderTopStyle).toBe('solid')
            expect(style.borderTopColor).not.toBe(canvas())
            expect(style.color).not.toBe(style.backgroundColor)
            const icon = partOf(badge, 'visit-status-icon')
            expect(getComputedStyle(icon).color).not.toBe(canvas())
            expect(icon.getBoundingClientRect().width).toBeGreaterThan(0)
        }
    )

    it.each(VARIANTS)(
        'outlines a %s service and keeps its icon and words',
        async (variant) => {
            await render(<Statuses />)
            const service = page.getByTestId(`service-${variant}`).element()
            const style = getComputedStyle(service)
            expect(style.borderTopStyle).toBe('solid')
            expect(style.borderTopColor).not.toBe(canvas())
            const icon = partOf(service, 'visit-service-icon')
            expect(getComputedStyle(icon).color).not.toBe(canvas())
            await expect
                .element(page.getByTestId(`service-${variant}`))
                .toHaveTextContent(/Vaccination/)
        }
    )
})
