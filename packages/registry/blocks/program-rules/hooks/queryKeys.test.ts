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

    it('keys a batch of enrollments by its sorted ids', () => {
        expect(programRulesQueryKeys.enrollments(['b', 'a'], true)).toEqual([
            'program-rules',
            'enrollments',
            'a,b',
            'with-events',
        ])
        expect(programRulesQueryKeys.enrollments(['a', 'b'], false)).toEqual([
            'program-rules',
            'enrollments',
            'a,b',
            'without-events',
        ])
    })
})
