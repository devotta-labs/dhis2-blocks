/// <reference types="@vitest/browser-playwright" />
import { page } from 'vitest/browser'
import type { FormPage, TrackerDataEntrySource } from '../sources/types'
import { cleanUp, memorySource, mount, visit, visitForm } from './__tests__/rig'
import { liveRegion } from '../../../test/liveRegion'

afterEach(cleanUp)

/** A two-row form with more to load, whose pages 2, 3, … are `pages` in turn; every page asked for is in `asked`. */
const paged = (pages: Array<() => Promise<FormPage>>) => {
    const asked: number[] = []
    const source: TrackerDataEntrySource = {
        ...memorySource(visitForm({ hasMore: true })).source,
        loadPage: async (_engine, number) => {
            asked.push(number)
            const next = pages.shift()
            if (next === undefined) {
                throw new Error(`No page ${number}`)
            }
            return next()
        },
    }
    return { source, asked }
}

const thirdRow = (hasMore: boolean) => async () => ({
    ...visitForm({ rows: [visit('r3', 'Visit 3')] }),
    hasMore,
})

test('a page that fails again says why again', async () => {
    const fail = async () => {
        throw new Error('The connection dropped')
    }
    const { source, asked } = paged([fail, fail])
    const { view } = await mount(source)
    const region = liveRegion('assertive')
    let said = 0
    const heard = new MutationObserver(() => {
        if (region.textContent === 'The connection dropped') {
            said += 1
        }
    })
    heard.observe(region, { childList: true })
    await view().loadMore()
    await expect.poll(() => said).toBe(1)
    await view().loadMore()
    await expect.poll(() => said).toBe(2)
    heard.disconnect()
    expect(asked).toEqual([2, 2])
    expect(view().loadMoreError).toBe('The connection dropped')
})

test('a form opened again starts from its first page, as its cells do', async () => {
    let calendar = 'iso8601'
    const { source, asked } = paged([thirdRow(true), thirdRow(false)])
    const { view, context, client } = await mount(source, {
        data: {
            'system/info': async () => ({ calendar, dateFormat: 'yyyy-mm-dd' }),
        },
    })
    await view().loadMore()
    expect(context().tables[0].rows).toHaveLength(3)

    // The server's calendar changes how every date reads: the form opens again.
    calendar = 'ethiopian'
    await client.invalidateQueries({ queryKey: ['data-entry', 'account'] })
    await expect.poll(() => context().settings.calendar).toBe('ethiopian')
    await expect.poll(() => context().tables[0]?.rows).toHaveLength(2)
    await expect.poll(() => view().hasMore).toBe(true)
    await view().loadMore()
    expect(context().tables[0].rows).toHaveLength(3)
    expect(asked).toEqual([2, 2])
    await expect
        .element(page.getByRole('button', { name: 'Show more events' }))
        .not.toBeInTheDocument()
})
