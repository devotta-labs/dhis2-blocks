const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const ALPHANUMERIC = `${LETTERS}0123456789`
const UID_LENGTH = 11

/** Uniform pick without modulo bias: bytes at or above the largest multiple of the alphabet size are skipped. */
const randomChars = (alphabet: string, count: number) => {
    const limit = 256 - (256 % alphabet.length)
    let out = ''
    while (out.length < count) {
        for (const byte of crypto.getRandomValues(new Uint8Array(count * 2))) {
            if (byte < limit && out.length < count) {
                out += alphabet[byte % alphabet.length]
            }
        }
    }
    return out
}

/** A DHIS2 UID: a letter, then ten letters or digits. */
export const generateUid = () =>
    randomChars(LETTERS, 1) + randomChars(ALPHANUMERIC, UID_LENGTH - 1)
