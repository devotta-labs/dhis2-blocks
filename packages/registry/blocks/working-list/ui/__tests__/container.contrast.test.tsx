import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { roleColour } from '../../../../test/roleColour'
import { LIST_CLASS } from '../Container/WorkingListContainer'

describe('working list container with more contrast', () => {
    it('draws one dark edge, without the card shadow ring', async () => {
        await render(<article data-testid="list" className={LIST_CLASS} />)
        const list = getComputedStyle(page.getByTestId('list').element())
        expect(list.borderTopColor).toBe(roleColour('border-strong'))
        expect(list.boxShadow).not.toContain('0px 0px 0px 1px')
    })
})
