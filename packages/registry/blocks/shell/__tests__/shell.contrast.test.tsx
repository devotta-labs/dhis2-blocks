import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { roleColour } from '../../../test/roleColour'
import { Pane, PaneGroup, PaneHeader } from '..'

test('pane hairlines take the stronger border colour with more contrast', async () => {
    await render(
        <div style={{ width: 600, height: 200 }}>
            <PaneGroup>
                <Pane />
                <Pane data-testid="second">
                    <PaneHeader title="Visits" data-testid="header" />
                </Pane>
            </PaneGroup>
        </div>
    )
    const surface = page.getByTestId('second').element().firstElementChild
    if (!surface) throw new Error('No pane surface')
    const strong = roleColour('border-strong')
    expect(getComputedStyle(surface).borderInlineStartWidth).toBe('1px')
    expect(getComputedStyle(surface).borderInlineStartColor).toBe(strong)
    expect(
        getComputedStyle(page.getByTestId('header').element()).borderBottomColor
    ).toBe(strong)
})
