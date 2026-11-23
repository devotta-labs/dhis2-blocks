import { exhaustLocalStorage } from '../test/storage.test-utils'
import {
    MAX_RECENT,
    readRemembered,
    withRecent,
    writeRemembered,
} from './remembered'

const KEY = 'dhis2-blocks:org-unit-switcher:u1'

afterEach(() => {
    localStorage.clear()
})

describe('remembered choice', () => {
    it('round trips', () => {
        writeRemembered('u1', { current: 'a', recent: ['b'] })

        expect(readRemembered('u1')).toEqual({ current: 'a', recent: ['b'] })
    })

    it('keeps users apart', () => {
        writeRemembered('u1', { current: 'a', recent: [] })

        expect(readRemembered('u2')).toEqual({ recent: [] })
        expect(localStorage.getItem(KEY)).not.toBeNull()
    })

    it.each(['{not json', '{"recent":"x"}'])(
        'treats a corrupt value as empty: %s',
        (value) => {
            localStorage.setItem(KEY, value)

            expect(readRemembered('u1')).toEqual({ recent: [] })
        }
    )

    it('swallows a failing read from an opaque origin', async () => {
        const iframe = document.createElement('iframe')
        iframe.sandbox.add('allow-scripts')
        iframe.srcdoc = '<!doctype html>'
        const loaded = Promise.withResolvers<void>()
        iframe.addEventListener('load', () => loaded.resolve(), { once: true })
        document.body.append(iframe)

        try {
            await loaded.promise
            const browserWindow = iframe.contentWindow
            if (!browserWindow) {
                throw new Error('Expected a sandboxed browser window')
            }
            expect(() => browserWindow.localStorage).toThrow(
                expect.objectContaining({ name: 'SecurityError' })
            )
            expect(readRemembered('u1', browserWindow)).toEqual({ recent: [] })
        } finally {
            iframe.remove()
        }
    })

    it('swallows a failing write', () => {
        exhaustLocalStorage()
        expect(() => localStorage.setItem(KEY, 'will not fit')).toThrow()
        expect(() => writeRemembered('u1', { recent: [] })).not.toThrow()
        expect(localStorage.getItem(KEY)).toBeNull()
    })
})

describe('withRecent', () => {
    it('moves an id to the front without repeating it', () => {
        expect(withRecent(['a', 'b'], 'b')).toEqual(['b', 'a'])
    })

    it('keeps the newest few', () => {
        const recent = ['a', 'b', 'c', 'd', 'e', 'f'].reduce(withRecent, [])

        expect(recent).toHaveLength(MAX_RECENT)
        expect(recent[0]).toBe('f')
    })
})
