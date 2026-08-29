import { describe, expect, it } from 'vitest'
import {
    buildUpstreamUrl,
    normalizeApiPath,
    normalizeUpstream,
} from '../lib/dhis2-proxy'

describe('DHIS2 proxy URL policy', () => {
    it('keeps the configured server path and forwards API query parameters', () => {
        const upstream = normalizeUpstream('https://play.example/dev/')
        const path = normalizeApiPath(['api', '42', 'tracker', 'events'])

        expect(
            buildUpstreamUrl(upstream, path, '?page=2&fields=id').toString()
        ).toBe(
            'https://play.example/dev/api/42/tracker/events?page=2&fields=id'
        )
    })

    it.each([
        ['not-api', '42'],
        ['api', '..', 'system', 'info'],
        ['api', '42', 'tracker/events'],
        ['api', '42', 'tracker\\events'],
    ])('rejects a non-normalized path: %s', (...segments: string[]) => {
        expect(() => normalizeApiPath(segments)).toThrow()
    })

    it('removes credentials and query state from the configured server', () => {
        expect(
            normalizeUpstream(
                'https://ignored:ignored@play.example/dev/?from=config#hash'
            ).toString()
        ).toBe('https://play.example/dev')
    })
})
