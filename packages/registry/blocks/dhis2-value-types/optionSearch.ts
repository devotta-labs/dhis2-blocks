import type { Option } from './types'

/** How many matches an option picker draws; typing narrows the rest (ICD has 14,000+). */
export const OPTION_LIMIT = 50

export interface OptionIndex {
    codes: string[]
    names: ReadonlyMap<string, string>
    /** Per option: the lowercase code, and " code name" so that a word start is " word". */
    lowerCodes: string[]
    lowerText: string[]
}

// Punctuation is not part of what people type to match, so it becomes a space in the index and the query.
// Combining marks stay: they belong to the letter before them (Devanagari, Lao, Khmer, a decomposed "é").
const lower = (text: string) =>
    text
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')

const indexes = new WeakMap<ReadonlyArray<Option>, OptionIndex>()

/** Built once per option list and cached for every cell that shares it. */
export const optionIndex = (options: ReadonlyArray<Option>): OptionIndex => {
    let index = indexes.get(options)
    if (!index) {
        index = {
            codes: options.map((option) => option.code),
            names: new Map(options.map((option) => [option.code, option.name])),
            lowerCodes: options.map((option) => lower(option.code).trim()),
            lowerText: options.map((option) =>
                lower(` ${option.code} ${option.name}`)
            ),
        }
        indexes.set(options, index)
    }
    return index
}

/**
 * Every typed word must appear, in any order. Ranked: the exact code, then codes
 * starting with the first word, then options whose words start with every typed
 * word, then the rest; the option list's order holds within each group.
 */
export const searchOptions = (
    index: OptionIndex,
    query: string,
    limit = OPTION_LIMIT
) => {
    const words = lower(query).split(' ').filter(Boolean)
    if (words.length === 0) {
        return { codes: index.codes.slice(0, limit), total: index.codes.length }
    }
    const exact = words.join(' ')
    const starts = words.map((word) => ` ${word}`)
    const groups: number[][] = [[], [], [], []]
    let total = 0
    for (let i = 0; i < index.codes.length; i += 1) {
        const text = index.lowerText[i]
        if (!words.every((word) => text.includes(word))) {
            continue
        }
        total += 1
        const code = index.lowerCodes[i]
        let group = 3
        if (code === exact) {
            group = 0
        } else if (code.startsWith(words[0])) {
            group = 1
        } else if (starts.every((start) => text.includes(start))) {
            group = 2
        }
        // Only the first `limit` of a group can be drawn; the rest only count.
        if (groups[group].length < limit) {
            groups[group].push(i)
        }
    }
    return {
        codes: groups
            .flat()
            .slice(0, limit)
            .map((i) => index.codes[i]),
        total,
    }
}
