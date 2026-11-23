import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { roleColour } from '../../../test/roleColour'
import { ValueInput } from '../ValueInput'

describe('the date picker with more contrast', () => {
    it('fills the picked day in the primary colour', async () => {
        await render(
            <ValueInput
                field={{ valueType: 'DATE' }}
                settings={{ calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' }}
                label="Date of visit"
                value="2026-10-14"
                onChange={() => {}}
            />
        )
        await userEvent.click(page.getByRole('button', { name: 'Choose date' }))
        const { backgroundColor, color } = getComputedStyle(
            page.getByRole('button', { name: '14 October 2026' }).element()
        )
        expect({ backgroundColor, color }).toEqual({
            backgroundColor: roleColour('primary'),
            color: roleColour('primary-foreground'),
        })
    })
})
