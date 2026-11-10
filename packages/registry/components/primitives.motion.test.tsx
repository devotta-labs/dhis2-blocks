import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Skeleton } from './skeleton'
import { Spinner } from './spinner'
import { Switch } from './switch'

// Runs with the system asking for reduced motion (the browser-motion project).
test('animations stop for reduced motion', async () => {
    await render(
        <>
            <Spinner data-testid="spinner" />
            <Skeleton data-testid="skeleton" />
            <Switch aria-label="Active" />
        </>
    )
    for (const id of ['spinner', 'skeleton']) {
        expect(
            getComputedStyle(page.getByTestId(id).element()).animationName
        ).toBe('none')
    }
    const thumb = document.querySelector('[data-slot="switch-thumb"]')
    if (thumb === null) {
        throw new Error('No switch thumb')
    }
    expect(getComputedStyle(thumb).transitionProperty).toBe('none')
})
