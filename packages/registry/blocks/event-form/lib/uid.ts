const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LETTERS_AND_DIGITS = `${LETTERS}0123456789`

/** A DHIS2 id made on the device: a letter, then ten letters or digits. */
export const generateUid = () =>
    // 32-bit draws keep the modulo bias below one in a hundred million.
    Array.from(crypto.getRandomValues(new Uint32Array(11)), (draw, at) => {
        const alphabet = at === 0 ? LETTERS : LETTERS_AND_DIGITS
        return alphabet[draw % alphabet.length]
    }).join('')
