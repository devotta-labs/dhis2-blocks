// WARNING: Keep the literal process.env.NODE_ENV read so bundlers can replace it in production builds.
declare const process: { readonly env: { readonly NODE_ENV?: string } }

const readNodeEnv = () => {
    try {
        return process.env.NODE_ENV
    } catch {
        return undefined
    }
}

const PRODUCTION = readNodeEnv() === 'production'

/**
 * Production builds show end users a short config message, not the details.
 * Only the bundler-replaced `process.env.NODE_ENV` says so: `import.meta`
 * would break consumers whose tests run as CommonJS.
 */
export const isProduction = () => PRODUCTION
