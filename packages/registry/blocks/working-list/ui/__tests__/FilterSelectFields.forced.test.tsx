import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ComboboxField } from '../FilterControls/FilterSelectFields'
import { WorkingListTextProvider } from '../WorkingListText'

describe('filter select fields in forced colours', () => {
    it('outlines the multi-select trigger when it has keyboard focus', async () => {
        await render(
            <WorkingListTextProvider translate={(message) => message}>
                <ComboboxField
                    multiple
                    label="Values"
                    values={[]}
                    options={[{ value: 'POS', label: 'Positive' }]}
                    filterPlaceholder="Search values"
                    noMatchText="No values match"
                    onChange={() => undefined}
                />
            </WorkingListTextProvider>
        )
        await userEvent.tab()
        const trigger = page.getByRole('combobox', { name: 'Values' }).element()
        expect(document.activeElement).toBe(trigger)
        expect(getComputedStyle(trigger).outlineStyle).toBe('solid')
    })
})
