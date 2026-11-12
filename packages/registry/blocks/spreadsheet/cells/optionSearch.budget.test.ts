import { optionIndex, searchOptions } from '@/components/dhis2-value-types'
import type { Option } from '@/components/dhis2-value-types'

const LETTERS = 'ABCDEFGHIJKLMN'

/** 14,240 ICD-like options, as `OptionCell.test.tsx` lists them. */
const icd = (): Option[] =>
    Array.from({ length: 14_240 }, (_, i) => {
        const group = String(Math.floor((i % 1100) / 11)).padStart(2, '0')
        const sub = i % 11
        const code = `${LETTERS[Math.floor(i / 1100)]}${group}${sub === 0 ? '' : `.${sub - 1}`}`
        return { code, name: `Diagnosis ${code}` }
    })

// The cell's budget is 200 ms to the first matches on a clinic desktop, taken as 4× slower than this machine. The
// search is timed on its own, best of three, so a shared runner's noise does not decide it.
test('indexing and searching a 14,240-option list takes under 50 ms', () => {
    const times = Array.from({ length: 3 }, () => {
        // A new list each time, so building its index is part of the time.
        const options = icd()
        const started = performance.now()
        const { codes } = searchOptions(optionIndex(options), 'a')
        const took = performance.now() - started
        expect(codes.length).toBeGreaterThan(0)
        return took
    })
    expect(Math.min(...times)).toBeLessThan(50)
})
