import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { roleColour } from '../../../test/roleColour'
import { TONE_CHIP, TONE_DOT } from '../CalendarCell'
import { TODAY_CLASS } from '../CalendarGrid'
import type { CalendarTone } from '../types'

const colours = async (className: string) => {
    await render(
        <span data-testid="mark" className={className}>
            6
        </span>
    )
    const { backgroundColor, color } = getComputedStyle(
        page.getByTestId('mark').element()
    )
    return { backgroundColor, color }
}

const ROLES = [
    ['neutral', 'neutral'],
    ['info', 'info'],
    ['positive', 'success'],
    ['warning', 'warning'],
    ['critical', 'destructive'],
] as const satisfies readonly (readonly [CalendarTone, string])[]

describe('calendar tones with more contrast', () => {
    it.each(ROLES)('darkens the %s dot', async (tone, role) => {
        const { backgroundColor } = await colours(TONE_DOT[tone])
        expect(backgroundColor).toBe(roleColour(`${role}-indicator`))
    })

    it.each(ROLES)(
        'writes a %s chip in its strong colour on its muted fill',
        async (tone, role) => {
            expect(await colours(TONE_CHIP[tone])).toEqual({
                backgroundColor: roleColour(`${role}-muted`),
                color: roleColour(`${role}-strong`),
            })
        }
    )

    it('circles today in the primary colour', async () => {
        expect(await colours(TODAY_CLASS)).toEqual({
            backgroundColor: roleColour('primary'),
            color: roleColour('primary-foreground'),
        })
    })
})
