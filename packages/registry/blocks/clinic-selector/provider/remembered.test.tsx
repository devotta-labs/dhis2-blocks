import {
    MAX_RECENT,
    readRemembered,
    withRecent,
    writeRemembered,
} from './remembered'

const KEY = 'dhis2-blocks:clinic-selector:u1'

afterEach(() => {
    vi.restoreAllMocks()
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

    it('swallows a failing read', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked')
        })

        expect(readRemembered('u1')).toEqual({ recent: [] })
    })

    it('swallows a failing write', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('full')
        })

        expect(() => writeRemembered('u1', { recent: [] })).not.toThrow()
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
