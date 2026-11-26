import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { contrastRatio } from '../../../test/contrastRatio'
import { VisitService, VisitStatus } from '..'
import { partOf, Statuses, VARIANTS } from './status.fixture'

describe('visit status', () => {
    it.each(VARIANTS)(
        'pairs a %s badge’s icon with words readable on its fill',
        async (variant) => {
            await render(<Statuses />)
            const badge = page.getByTestId(variant).element()
            expect(badge.getAttribute('data-status')).toBe(variant)
            expect(
                partOf(badge, 'visit-status-icon').querySelector('svg')
            ).not.toBeNull()
            expect(badge.textContent).not.toBe('')
            const { color, backgroundColor } = getComputedStyle(badge)
            expect(
                contrastRatio(color, backgroundColor)
            ).toBeGreaterThanOrEqual(4.5)
        }
    )

    it('gives each status its own icon', async () => {
        await render(<Statuses />)
        const icons = VARIANTS.map(
            ([variant]) =>
                partOf(page.getByTestId(variant).element(), 'visit-status-icon')
                    .innerHTML
        )
        expect(new Set(icons).size).toBe(VARIANTS.length)
    })

    it('uses your words instead of the default name', async () => {
        const screen = await render(
            <VisitStatus variant="completed">Done</VisitStatus>
        )
        await expect.element(screen.getByText('Done')).toBeVisible()
        await expect
            .element(screen.getByText('Completed'))
            .not.toBeInTheDocument()
    })

    it.each(VARIANTS)(
        'marks a %s service with an icon a reader can see and words',
        async (variant) => {
            await render(<Statuses />)
            const service = page.getByTestId(`service-${variant}`).element()
            expect(service.parentElement?.tagName).toBe('LI')
            const icon = partOf(service, 'visit-service-icon')
            expect(
                contrastRatio(
                    getComputedStyle(icon).color,
                    getComputedStyle(service).backgroundColor
                )
            ).toBeGreaterThanOrEqual(3)
            expect(
                partOf(service, 'visit-service-status').textContent
            ).not.toBe('')
        }
    )

    it('leaves a service without a status plain', async () => {
        const screen = await render(
            <VisitService data-testid="service">Growth monitoring</VisitService>
        )
        const service = screen.getByTestId('service').element()
        expect(service).toHaveTextContent(/^Growth monitoring$/)
        expect(service.querySelector('svg')).toBeNull()
        expect(service.parentElement?.tagName).not.toBe('LI')
    })
})
