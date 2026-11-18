// A number as a person types it: `.5`, `5.` and `007` are all read.
const TYPED_NUMBER = /^(?<sign>-?)(?<whole>\d*)(?:\.(?<fraction>\d*))?$/

/**
 * A typed number in the form DHIS2 stores: no leading zeros, `-0` as `0`, a
 * digit before the point and none after a bare one. The fraction's digits stay
 * as typed. Text that is not a plain number comes back as `undefined`.
 */
export const canonicalNumber = (text: string): string | undefined => {
    const groups = TYPED_NUMBER.exec(text)?.groups
    if (groups === undefined || !/\d/.test(text)) {
        return undefined
    }
    const integerPart = groups.whole.replace(/^0+/, '') || '0'
    const digits = groups.fraction
        ? `${integerPart}.${groups.fraction}`
        : integerPart
    return /[1-9]/.test(digits) ? `${groups.sign}${digits}` : digits
}
