/**
 * Declared here so apps without Node types still compile. Bundlers replace
 * the literal `process.env.NODE_ENV`, so the expression must stay as is.
 */
declare const process: { readonly env: { readonly NODE_ENV?: string } }

/** Where nothing replaced it, `process` is undefined and reading it throws. */
const readNodeEnv = (): string | undefined => {
    try {
        return process.env.NODE_ENV
    } catch {
        return undefined
    }
}

/** Fixed at build time, so read once. */
const PRODUCTION = readNodeEnv() === 'production'

/**
 * Production builds show end users a short config message, not the details.
 * Only the bundler-replaced `process.env.NODE_ENV` says so: `import.meta`
 * would break consumers whose tests run as CommonJS.
 */
export const isProduction = (): boolean => PRODUCTION
