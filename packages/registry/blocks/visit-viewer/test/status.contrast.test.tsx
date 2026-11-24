import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { contrastRatio } from '../../../test/contrastRatio'
import { roleColour } from '../../../test/roleColour'
import { partOf, Statuses, VARIANTS } from './status.fixture'

describe('visit statuses with more contrast', () => {
    it('runs with the OS asking for more contrast', () => {
        expect(matchMedia('(prefers-contrast: more)').matches).toBe(true)
    })

    it.each(VARIANTS)(
        'writes a %s badge in its strong colour on its fill',
        async (variant, role) => {
            await render(<Statuses />)
            const { color, backgroundColor } = getComputedStyle(
                page.getByTestId(variant).element()
            )
            expect({ color, backgroundColor }).toEqual({
                color: roleColour(`${role}-strong`),
                backgroundColor: roleColour(`${role}-fill`),
            })
            expect(
                contrastRatio(color, backgroundColor)
            ).toBeGreaterThanOrEqual(7)
        }
    )

    it.each(VARIANTS)(
        'darkens a %s service’s icon to its indicator',
        async (variant, role) => {
            await render(<Statuses />)
            const service = page.getByTestId(`service-${variant}`).element()
            const { color } = getComputedStyle(
                partOf(service, 'visit-service-icon')
            )
            expect(color).toBe(roleColour(`${role}-indicator`))
            expect(
                contrastRatio(color, getComputedStyle(service).backgroundColor)
            ).toBeGreaterThanOrEqual(4.5)
        }
    )
})
