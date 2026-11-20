import ts from 'typescript'

/** Packages supplied by the consumer app rather than installed by a registry item. */
export const HOST_PACKAGES = new Set(['react', 'react-dom'])

/** Every module specifier a source file imports, in order of appearance. */
export const importedSpecifiers = (source: string) =>
    ts
        .preProcessFile(source, true, true)
        .importedFiles.map((file) => file.fileName)

/** `./x` and `../x` (and `.` / `..`): a path, never an installable package. */
export const isRelative = (specifier: string) =>
    /^\.\.?(?:\/|$)/.test(specifier)

/** `@base-ui/react/button` installs with `@base-ui/react`. */
export const packageName = (specifier: string) =>
    specifier
        .split('/')
        .slice(0, specifier.startsWith('@') ? 2 : 1)
        .join('/')
