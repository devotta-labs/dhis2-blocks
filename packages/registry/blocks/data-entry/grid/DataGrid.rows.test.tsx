/// <reference types="@vitest/browser-playwright" />
import { page } from 'vitest/browser'
import { makeTable, mount } from './__tests__/gridRig'

test('a row’s own errors and warnings show in its header, marked as a cell’s are', async () => {
    await mount([makeTable({ rows: ['2026-10-20', '2026-10-21'] })], {
        rowMessages: [
            [
                't1r0',
                [
                    { kind: 'error', text: 'Rules failed: x', source: 'rule' },
                    {
                        kind: 'warningOnComplete',
                        text: 'Check the date',
                        source: 'rule',
                    },
                ],
            ],
        ],
    })
    const header = page.getByRole('rowheader').first()
    await expect.element(header).toHaveTextContent('Rules failed: x')
    await expect.element(header).toHaveTextContent('Check the date')
    const [error, warning] = header.getByRole('listitem').elements()
    expect([error.textContent, warning.textContent]).toEqual([
        'Rules failed: x',
        'Check the date',
    ])
    for (const message of [error, warning]) {
        expect(getComputedStyle(message).borderInlineStartWidth).toBe('2px')
    }
    expect(getComputedStyle(error).borderInlineStartColor).not.toBe(
        getComputedStyle(warning).borderInlineStartColor
    )
    // The other row says nothing.
    await expect
        .element(page.getByRole('rowheader').nth(1))
        .toHaveTextContent(/^2026-10-21$/)
})

test('row headers take at most 30% of a narrow screen, so the page reflows at 400% zoom', async () => {
    const { innerWidth, innerHeight } = window
    await page.viewport(320, 640)
    try {
        await mount([makeTable()])
        const width = page
            .getByRole('rowheader')
            .element()
            .getBoundingClientRect().width
        expect(width).toBeLessThanOrEqual(320 * 0.3 + 1)
    } finally {
        await page.viewport(innerWidth, innerHeight)
    }
})
