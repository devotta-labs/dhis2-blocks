import { afterEach, describe, expect, it, vi } from 'vitest'
import { nominatimSearch } from '../search'

const answer = [
    {
        display_name: 'Bo, Southern Province, Sierra Leone, Sierra Leone',
        name: 'Bo',
        lat: '7.9647',
        lon: '-11.7383',
        boundingbox: ['7.80', '8.12', '-11.90', '-11.58'],
    },
    {
        display_name: 'Ngelehun, Bo District, Sierra Leone',
        lat: '8.0',
        lon: '-11.5',
    },
]

describe('nominatimSearch', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('reads places with their extent, longitude first', async () => {
        const fetched = vi.fn<typeof fetch>(async () => Response.json(answer))
        vi.stubGlobal('fetch', fetched)
        const places = await nominatimSearch('Bo', new AbortController().signal)
        expect(places[0]).toEqual({
            name: 'Bo',
            detail: 'Southern Province, Sierra Leone',
            position: [-11.7383, 7.9647],
            bounds: [
                [-11.9, 7.8],
                [-11.58, 8.12],
            ],
        })
        expect(places[1]).toMatchObject({
            name: 'Ngelehun',
            detail: 'Bo District, Sierra Leone',
        })
        expect(String(fetched.mock.calls[0]?.[0])).toContain('q=Bo')
    })

    it('fails when the service refuses', async () => {
        vi.stubGlobal('fetch', async () => new Response('', { status: 429 }))
        await expect(
            nominatimSearch('Bo', new AbortController().signal)
        ).rejects.toThrow()
    })
})
