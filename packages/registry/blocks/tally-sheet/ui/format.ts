import i18n from '@dhis2/d2-i18n'

const MAX_DIGITS = 6
const DIGIT = /\p{Nd}/u

/** A count in the user's language's digits and grouping, or plain digits when the language has no number format. */
export const formatCount = (count: number) => {
    try {
        return new Intl.NumberFormat(i18n.language.replace('_', '-')).format(
            count
        )
    } catch {
        return String(count)
    }
}

const asciiDigit = (character: string) => {
    const point = character.codePointAt(0) ?? 0
    let zero = point
    while (zero > 0 && DIGIT.test(String.fromCodePoint(zero - 1))) {
        zero -= 1
    }
    return String((point - zero) % 10)
}

/**
 * What an edit field keeps of typed text: every decimal digit, in any script, as an ASCII digit, nothing else, and
 * no more than six digits. So a draft is always a whole number or empty.
 */
export const countDraft = (text: string) =>
    Array.from(text)
        .flatMap((character) =>
            DIGIT.test(character) ? [asciiDigit(character)] : []
        )
        .slice(0, MAX_DIGITS)
        .join('')
