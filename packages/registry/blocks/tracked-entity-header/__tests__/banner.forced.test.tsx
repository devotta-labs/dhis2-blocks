import React from 'react'
import { page } from 'vitest/browser'
import { TrackedEntityBanner } from '..'
import { renderParts } from './valuePartsSupport'

describe('tracked entity banner in forced colours', () => {
    it('runs with forced colours active', () => {
        expect(matchMedia('(forced-colors: active)').matches).toBe(true)
    })

    it('keeps the inactive banner edged and its tags outlined in words', async () => {
        await renderParts(<TrackedEntityBanner />, {
            person: (raw) => ({
                ...raw,
                inactive: true,
                potentialDuplicate: true,
            }),
        })
        await expect.element(page.getByText('Inactive')).toBeVisible()

        const section = getComputedStyle(page.getByRole('region').element())
        expect(section.borderTopStyle).toBe('solid')
        expect(section.borderTopWidth).toBe('1px')
        for (const tag of ['Inactive', 'Possible duplicate']) {
            const style = getComputedStyle(page.getByText(tag).element())
            expect(style.borderTopStyle).toBe('solid')
            expect(style.borderTopColor).not.toBe(style.backgroundColor)
            expect(style.color).not.toBe(style.backgroundColor)
        }
    })
})
