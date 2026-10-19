// Shared by the ui registry generator and the working-list manifest test, so
// both read a source file's imports the same way.

// Provided by the consumer app, never installed by an item.
export const HOST_PACKAGES = new Set(['react', 'react-dom'])

// Static imports and re-exports, side-effect imports and `import('x')`.
const IMPORT_SPECIFIER =
    /(?:\b(?:import|export)\s[^'"]*?\bfrom|\bimport\s*\(?)\s*['"]([^'"]+)['"]/g

/** Every module specifier a source file imports, in order of appearance. */
export const importedSpecifiers = (source: string): string[] =>
    [...source.matchAll(IMPORT_SPECIFIER)].map((match) => match[1])

/** `./x` and `../x` (and `.` / `..`): a path, never an installable package. */
export const isRelative = (specifier: string): boolean =>
    /^\.\.?(?:\/|$)/.test(specifier)

/** `@base-ui/react/button` installs with `@base-ui/react`. */
export const packageName = (specifier: string): string =>
    specifier
        .split('/')
        .slice(0, specifier.startsWith('@') ? 2 : 1)
        .join('/')
