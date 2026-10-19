import { programRulesQueryKeys } from './queryKeys'

describe('programRulesQueryKeys', () => {
    it('offers an enrollment prefix that covers both cached forms', () => {
        const prefix = programRulesQueryKeys.enrollment('en')
        for (const withEvents of [true, false]) {
            const key = programRulesQueryKeys.enrollment('en', withEvents)
            expect(key.slice(0, prefix.length)).toEqual([...prefix])
            expect(key.length).toBeGreaterThan(prefix.length)
        }
    })
})
