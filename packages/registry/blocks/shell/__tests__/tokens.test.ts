import { readdirSync, readFileSync } from 'node:fs'

// Heights, font sizes, padding and radius come from the token layer, so a
// density reaches every one of them.

const DIRECTORY = new URL('..', import.meta.url)
const HARD_CODED =
    /(?<![\w-])(?:h|min-h|max-h|p[xytblrse]?|text|leading|rounded(?:-[a-z]{1,2})?)-(?:[1-9][\d.]*|\[(?!calc\(var\())(?![\w-])/g

test('no shell primitive hard-codes a height, font size, padding or radius', () => {
    const found = readdirSync(DIRECTORY)
        .filter((name) => name.endsWith('.tsx'))
        .flatMap((name) =>
            [
                ...readFileSync(new URL(name, DIRECTORY), 'utf8').matchAll(
                    HARD_CODED
                ),
            ].map((match) => `${name}: ${match[0]}`)
        )
    expect(found).toEqual([])
})
