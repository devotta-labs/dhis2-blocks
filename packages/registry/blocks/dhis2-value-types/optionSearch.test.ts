import { OPTION_LIMIT, optionIndex, searchOptions } from './optionSearch'
import type { Option } from './types'

const options: Option[] = [
    { code: 'A00', name: 'Cholera' },
    {
        code: 'A000',
        name: 'Cholera due to Vibrio cholerae 01, biovar cholerae',
    },
    { code: 'I21', name: 'Acute myocardial infarction' },
    {
        code: 'I210',
        name: 'Acute transmural myocardial infarction of anterior wall',
    },
    { code: 'I012', name: 'Acute rheumatic myocarditis' },
    { code: 'K81', name: 'Cholecystitis' },
]
const index = optionIndex(options)
const codes = (query: string) => searchOptions(index, query).codes

test('the exact code comes first, then codes that start with it', () => {
    expect(codes('I21')).toEqual(['I21', 'I210'])
})

test('words match in any order', () => {
    expect(codes('infarction acute')).toEqual(['I21', 'I210'])
})

test('whole-word starts rank above matches inside a word, keeping list order', () => {
    expect(codes('chol')).toEqual(['A00', 'A000', 'K81'])
    expect(codes('myocard')).toEqual(['I21', 'I210', 'I012'])
})

test('a code that starts with the word outranks a name that does', () => {
    const list = [
        { code: 'X1', name: 'Alpha' },
        { code: 'ALPS', name: 'Other' },
    ]
    expect(searchOptions(optionIndex(list), 'alp').codes).toEqual([
        'ALPS',
        'X1',
    ])
})

test('words that only appear inside other words rank last', () => {
    const list = [
        { code: 'X1', name: 'Malaria' },
        { code: 'X2', name: 'Lari' },
    ]
    expect(searchOptions(optionIndex(list), 'lari').codes).toEqual(['X2', 'X1'])
})

test('punctuation is ignored, and a code with punctuation is still exact', () => {
    expect(codes('cholerae, 01')).toEqual(['A000'])
    const list = [
        { code: 'AB-12-XY', name: 'Other' },
        { code: 'AB-12-X', name: 'Other' },
    ]
    expect(searchOptions(optionIndex(list), 'ab-12-x').codes).toEqual([
        'AB-12-X',
        'AB-12-XY',
    ])
})

test('the total counts every match, not just the ones returned', () => {
    expect(searchOptions(index, 'a', 2)).toEqual({
        codes: ['A00', 'A000'],
        total: 5,
    })
})

test('a query with no match finds nothing', () => {
    expect(searchOptions(index, 'zzz')).toEqual({ codes: [], total: 0 })
})

test('an empty query lists the options in order', () => {
    expect(codes('')).toEqual(['A00', 'A000', 'I21', 'I210', 'I012', 'K81'])
    expect(codes(' , ')).toHaveLength(6)
    expect(searchOptions(index, '', 2)).toEqual({
        codes: ['A00', 'A000'],
        total: 6,
    })
})

test('the index keeps each code and its name, and is cached per list', () => {
    expect(index.codes).toEqual(options.map((option) => option.code))
    expect(index.names.get('I21')).toBe('Acute myocardial infarction')
    expect(optionIndex(options)).toBe(optionIndex(options))
    expect(optionIndex([...options])).not.toBe(index)
})

test('a one-letter query over 14,240 options returns one page and counts them all', () => {
    // A000 to O239. Names use no letter k, so only the 1,000 K codes match "k".
    const names = ['alpha', 'bravo', 'delta', 'gamma', 'sigma', 'omega']
    const many = Array.from({ length: 14_240 }, (_, i) => ({
        code: `${String.fromCharCode(65 + Math.floor(i / 1000))}${String(i % 1000).padStart(3, '0')}`,
        name: `${names[i % names.length]} ${names[(i * 7) % names.length]}`,
    }))
    const manyIndex = optionIndex(many)
    expect(manyIndex).toBe(optionIndex(many))

    const result = searchOptions(manyIndex, 'k')
    expect(result.codes).toHaveLength(OPTION_LIMIT)
    expect(result.codes[0]).toBe('K000')
    expect(result.codes.at(-1)).toBe('K049')
    expect(result.total).toBe(1000)
})

test('combining marks stay part of their word', () => {
    const options: Option[] = [
        { code: 'HI', name: 'हिन्दी भाषा' },
        // Holds the same letters as हिन्दी without its marks, so splitting at marks would match it.
        { code: 'RI', name: 'हर नदी' },
        { code: 'CA', name: 'cafe\u0301 noir' },
    ]
    const index = optionIndex(options)
    expect(searchOptions(index, 'हिन्दी')).toEqual({ codes: ['HI'], total: 1 })
    // न starts a word only in नदी; inside हिन्दी it still matches, ranked after.
    expect(searchOptions(index, 'न')).toEqual({ codes: ['RI', 'HI'], total: 2 })
    expect(searchOptions(index, 'café')).toEqual({ codes: ['CA'], total: 1 })
})
