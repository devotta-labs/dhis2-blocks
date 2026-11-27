import { createPortal } from 'react-dom'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { InputGroup, InputGroupAddon, InputGroupInput } from './input-group'

describe('InputGroupAddon', () => {
    it('focuses the box when its own text is clicked', async () => {
        const screen = await render(
            <InputGroup>
                <InputGroupInput aria-label="Amount" />
                <InputGroupAddon align="inline-end">kg</InputGroupAddon>
            </InputGroup>
        )
        await userEvent.click(screen.getByText('kg'))
        await expect
            .element(screen.getByRole('textbox', { name: 'Amount' }))
            .toHaveFocus()
    })

    it('leaves focus in a panel opened from it, which sits elsewhere on the page', async () => {
        const screen = await render(
            <InputGroup>
                <InputGroupInput aria-label="Location" />
                <InputGroupAddon align="inline-end">
                    {createPortal(
                        <input aria-label="Search for a place" />,
                        document.body
                    )}
                </InputGroupAddon>
            </InputGroup>
        )
        const search = screen.getByRole('textbox', {
            name: 'Search for a place',
        })
        await userEvent.click(search)
        await expect.element(search).toHaveFocus()
    })
})
