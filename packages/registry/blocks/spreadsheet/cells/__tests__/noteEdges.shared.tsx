import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { NOTE_TONES, NOTES_POPUP_CLASS } from '../CellStatus'

const luminance = (rgb: string): number => {
    const [r, g, b] = (rgb.match(/\d+/g) ?? []).slice(0, 3).map((channel) => {
        const value = Number(channel) / 255
        return value <= 0.03928
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (first: string, second: string): number => {
    const [lighter, darker] = [luminance(first), luminance(second)].sort(
        (a, b) => b - a
    )
    return (lighter + 0.05) / (darker + 0.05)
}

/** Each note tone's edge stands out from the notes popup it sits in. */
export const describeNoteEdges = (theme: string) =>
    describe(`note edges in the ${theme} theme`, () => {
        it.each(['error', 'warning', 'info'] as const)(
            'shows the %s edge at 3:1 or more',
            async (tone) => {
                await render(
                    <span data-testid="popup" className={NOTES_POPUP_CLASS}>
                        <span
                            data-testid="note"
                            className={`border-s-2 ${NOTE_TONES[tone]}`}
                        >
                            Note
                        </span>
                    </span>
                )
                const edge = getComputedStyle(
                    page.getByTestId('note').element()
                ).borderInlineStartColor
                const surface = getComputedStyle(
                    page.getByTestId('popup').element()
                ).backgroundColor
                expect(contrast(edge, surface)).toBeGreaterThanOrEqual(3)
            }
        )
    })
