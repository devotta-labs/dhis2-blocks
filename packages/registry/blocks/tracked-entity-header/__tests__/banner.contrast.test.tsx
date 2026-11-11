import React from 'react'
import { page } from 'vitest/browser'
import { TrackedEntityBanner } from '..'
import { roleColour } from '../../../test/roleColour'
import { renderParts } from './valuePartsSupport'

describe('tracked entity banner with more contrast', () => {
    it('runs with more contrast', () => {
        expect(matchMedia('(prefers-contrast: more)').matches).toBe(true)
    })

    it('keeps the inactive surface and its tags in the darker roles', async () => {
        await renderParts(<TrackedEntityBanner />, {
            person: (raw) => ({
                ...raw,
                inactive: true,
                potentialDuplicate: true,
            }),
        })
        await expect.element(page.getByText('Inactive')).toBeVisible()

        const section = getComputedStyle(page.getByRole('region').element())
        expect(section.backgroundColor).toBe(roleColour('muted'))
        for (const tag of ['Inactive', 'Possible duplicate']) {
            const style = getComputedStyle(page.getByText(tag).element())
            expect(style.color).toBe(roleColour('foreground'))
            expect(style.borderTopColor).toBe(roleColour('border'))
        }
        const label = getComputedStyle(page.getByText('Unique ID').element())
        expect(label.color).toBe(roleColour('muted-foreground'))
    })
})
