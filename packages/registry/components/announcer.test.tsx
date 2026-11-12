import React from 'react'
import { render } from 'vitest-browser-react'
import { announce } from './announcer'
import { Dialog, DialogContent, DialogTitle } from './dialog'

const polite = () =>
    document.querySelectorAll<HTMLElement>(
        '[role="status"][aria-live="polite"]'
    )
const assertive = () =>
    document.querySelectorAll<HTMLElement>(
        '[role="alert"][aria-live="assertive"]'
    )

/** Every non-empty text the region shows, in order. */
const record = (region: HTMLElement) => {
    const said: string[] = []
    new MutationObserver(() => {
        if (region.textContent) {
            said.push(region.textContent)
        }
    }).observe(region, { childList: true, characterData: true, subtree: true })
    return said
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 400))

/** Makes sure both regions exist and have finished speaking. */
const quiet = async () => {
    announce('Ready')
    await settle()
}

/** Lets the text still being said finish, so each test starts quiet. */
afterEach(settle)

test('creates both regions with aria-live, once', async () => {
    announce('Ready')
    announce('Ready again')
    expect(polite()).toHaveLength(1)
    expect(assertive()).toHaveLength(1)
    expect(polite()[0]).toHaveClass('sr-only')
    expect(assertive()[0]).toHaveClass('sr-only')
    expect(polite()[0].parentElement).toBe(document.body)
})

test('empties the region first, so the same text said twice is heard twice', async () => {
    announce('Prime')
    await expect.poll(() => polite()[0].textContent).toBe('Prime')
    const said: string[] = []
    const region = polite()[0]
    new MutationObserver(() => said.push(region.textContent ?? '')).observe(
        region,
        { childList: true, characterData: true, subtree: true }
    )
    announce('All changes saved')
    await expect.poll(() => said).toContain('All changes saved')
    announce('All changes saved')
    await expect
        .poll(() => said.filter((text) => text === 'All changes saved'))
        .toHaveLength(2)
    expect(said[said.length - 2]).toBe('')
})

test('a newer text replaces one still waiting', async () => {
    await quiet()
    const said = record(polite()[0])
    announce('40 results')
    announce('12 results')
    announce('3 results')
    await expect.poll(() => said).toEqual(['40 results', '3 results'])
    await settle()
    expect(said).toEqual(['40 results', '3 results'])
})

test('an assertive text is not replaced by a polite one', async () => {
    await quiet()
    const errors = record(assertive()[0])
    const statuses = record(polite()[0])
    announce('Save failed', 'assertive')
    announce('3 rows')
    await expect.poll(() => errors).toEqual(['Save failed'])
    await expect.poll(() => statuses).toEqual(['3 rows'])
})

test('still announces while a modal dialog is open', async () => {
    announce('Ready')
    await render(
        <Dialog open>
            <DialogContent>
                <DialogTitle>Edit</DialogTitle>
            </DialogContent>
        </Dialog>
    )
    await expect
        .poll(() => document.querySelector('[data-base-ui-inert]'))
        .not.toBeNull()
    announce('Done')
    const region = polite()[0]
    await expect.poll(() => region.textContent).toBe('Done')
    expect(region.closest('[aria-hidden="true"]')).toBeNull()
})
