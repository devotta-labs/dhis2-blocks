import { z } from 'zod'

/**
 * Bundlers replace the literal `process.env.NODE_ENV`; where nothing does,
 * `process` is undefined in the browser, so reading it throws.
 */
const processNodeEnv = (): string | undefined => {
    try {
        return process.env.NODE_ENV
    } catch {
        return undefined
    }
}

/**
 * Vite's `import.meta.env`, which Vite injects where the literal appears.
 * Other bundlers may leave it undefined, so it is parsed, not trusted.
 */
const BundlerEnvSchema = z.object({ NODE_ENV: z.string().optional() })

const bundlerNodeEnv = (): string | undefined =>
    BundlerEnvSchema.safeParse(
        // @ts-ignore -- typed only where Vite's client types are loaded; an
        // expect-error would fail there, so this cannot be stricter.
        import.meta.env
    ).data?.NODE_ENV

/**
 * Production builds show end users a short config message, not the details.
 * Either the bundler's `process.env.NODE_ENV` or Vite's `import.meta.env`
 * can say so.
 */
export const isProduction = () =>
    processNodeEnv() === 'production' || bundlerNodeEnv() === 'production'
