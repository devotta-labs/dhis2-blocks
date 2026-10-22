import ts from 'typescript'

// Provided by the consumer app, never installed by an item.
export const HOST_PACKAGES = new Set(['react', 'react-dom'])

/** Every module specifier a source file imports, in order of appearance. */
export const importedSpecifiers = (source: string): string[] =>
    ts
        .preProcessFile(source, true, true)
        .importedFiles.map((file) => file.fileName)

/** `./x` and `../x` (and `.` / `..`): a path, never an installable package. */
export const isRelative = (specifier: string): boolean =>
    /^\.\.?(?:\/|$)/.test(specifier)

/** `@base-ui/react/button` installs with `@base-ui/react`. */
export const packageName = (specifier: string): string =>
    specifier
        .split('/')
        .slice(0, specifier.startsWith('@') ? 2 : 1)
        .join('/')
