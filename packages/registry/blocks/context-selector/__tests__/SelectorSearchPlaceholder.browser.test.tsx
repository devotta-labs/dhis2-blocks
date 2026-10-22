import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ContextSelector, EventSelector, StageSelector } from '../index'
import type { Option } from '../types'

const options: Option[] = Array.from({ length: 11 }, (_, index) => ({
    value: `option-${index}`,
    label: `Option ${index}`,
}))

describe('locked selector search placeholders', () => {
    it('preserves Capture casing for a stage label', async () => {
        await render(
            <ContextSelector>
                <StageSelector
                    label="Clinical Stage"
                    options={options}
                    open
                    onOpenChange={() => undefined}
                />
            </ContextSelector>
        )

        await expect
            .element(page.getByPlaceholder('Search for a Clinical Stage'))
            .toBeVisible()
    })

    it('uses the host-owned event label verbatim', async () => {
        await render(
            <ContextSelector>
                <EventSelector
                    label="Date of Consultation"
                    options={options}
                    open
                    onOpenChange={() => undefined}
                />
            </ContextSelector>
        )

        await expect
            .element(page.getByPlaceholder('Search for a Date of Consultation'))
            .toBeVisible()
    })
})
