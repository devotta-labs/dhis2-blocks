/**
 * Declared here so apps without Node types still compile. Bundlers replace
 * the literal `process.env.NODE_ENV`, so the expression must stay as is.
 */
declare const process: { readonly env: { readonly NODE_ENV?: string } }

/** Where nothing replaced it, `process` is undefined and reading it throws. */
const readProcessNodeEnv = (): string | undefined => {
    try {
        return process.env.NODE_ENV
    } catch {
        return undefined
    }
}

/** Fixed at build time, so read once. */
const PROCESS_PRODUCTION = readProcessNodeEnv() === 'production'

/**
 * Production builds show end users a short config message, not the details.
 * Either the bundler's `process.env.NODE_ENV` or Vite's `import.meta.env` can
 * say so. `import.meta.env` is read on each call (a property read), because
 * tests switch it with `vi.stubEnv` after this module loads.
 */
export const isProduction = (): boolean =>
    PROCESS_PRODUCTION ||
    // @ts-ignore -- typed only where Vite's client types are loaded, where an
    // expect-error would fail; elsewhere it may be undefined, hence `?.`.
    import.meta.env?.NODE_ENV === 'production'
