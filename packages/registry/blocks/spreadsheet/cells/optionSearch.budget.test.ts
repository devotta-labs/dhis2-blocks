import { optionIndex, searchOptions } from '@/components/dhis2-value-types'

const LETTERS = 'ABCDEFGHIJKLMN'

const icd = () =>
    Array.from({ length: 14_240 }, (_, i) => {
        const group = String(Math.floor((i % 1100) / 11)).padStart(2, '0')
        const sub = i % 11
        const code = `${LETTERS[Math.floor(i / 1100)]}${group}${sub === 0 ? '' : `.${sub - 1}`}`
        return { code, name: `Diagnosis ${code}` }
    })

test('indexing and searching a 14,240-option list takes under 50 ms', () => {
    const times = Array.from({ length: 3 }, () => {
        const options = icd()
        const started = performance.now()
        const { codes } = searchOptions(optionIndex(options), 'a')
        const took = performance.now() - started
        expect(codes.length).toBeGreaterThan(0)
        return took
    })
    expect(Math.min(...times)).toBeLessThan(50)
})
