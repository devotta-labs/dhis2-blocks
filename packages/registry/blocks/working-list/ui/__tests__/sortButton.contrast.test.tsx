import React from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { SORT_BUTTON_CLASS } from '../WorkingListTable/WorkingListTableView'

describe('sort button with more contrast', () => {
    it('outlines keyboard focus in the full focus colour', async () => {
        const screen = await render(
            <button type="button" className={SORT_BUTTON_CLASS}>
                Name
            </button>
        )
        await userEvent.tab()
        const button = screen.getByRole('button').element()
        expect(document.activeElement).toBe(button)
        expect(getComputedStyle(button).outlineStyle).toBe('solid')
        expect(getComputedStyle(button).outlineColor).toBe('rgb(13, 71, 161)')
    })
})
