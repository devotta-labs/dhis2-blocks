import * as React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { userEvent } from 'vitest/browser'
import { RadioGroup, RadioGroupItem } from './radio-group'

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

describe('radio group', () => {
    const original = globalThis.IS_REACT_ACT_ENVIRONMENT

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true
    })
    afterEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = original
    })

    it('radio group is keyboard operable', async () => {
        const onValueChange = vi.fn()
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        act(() => {
            root.render(
                <RadioGroup
                    aria-label="Outcome"
                    defaultValue="a"
                    onValueChange={onValueChange}
                >
                    <RadioGroupItem value="a" aria-label="Alpha" />
                    <RadioGroupItem value="b" aria-label="Beta" />
                    <RadioGroupItem value="c" aria-label="Gamma" />
                </RadioGroup>
            )
        })

        const group = container.querySelector('[role="radiogroup"]')
        expect(group).not.toBeNull()
        expect(group?.getAttribute('aria-label')).toBe('Outcome')

        const radios = [
            ...container.querySelectorAll<HTMLElement>('[role="radio"]'),
        ]
        expect(radios).toHaveLength(3)
        expect(radios[0].getAttribute('aria-checked')).toBe('true')

        radios[0].focus()
        await userEvent.keyboard('{ArrowDown}')

        expect(onValueChange).toHaveBeenCalledTimes(1)
        expect(onValueChange.mock.calls[0][0]).toBe('b')
        expect(radios[1].getAttribute('aria-checked')).toBe('true')
        expect(document.activeElement).toBe(radios[1])

        act(() => root.unmount())
        container.remove()
    })
})
