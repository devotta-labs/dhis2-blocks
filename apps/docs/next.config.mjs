import path from 'node:path'
import { networkInterfaces } from 'node:os'
import { createMDX } from 'fumadocs-mdx/next'

const workspaceRoot = path.join(import.meta.dirname, '../..')
const previewOrigin = process.env.PREVIEWS_DEV_ORIGIN ?? 'http://127.0.0.1:4173'
const allowedDevOrigins = [
    'localhost',
    '127.0.0.1',
    ...Object.values(networkInterfaces())
        .flatMap((connections) => connections ?? [])
        .filter(
            (connection) => connection.family === 'IPv4' && !connection.internal
        )
        .map((connection) => connection.address),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
    allowedDevOrigins,
    outputFileTracingRoot: workspaceRoot,
    reactStrictMode: true,
    turbopack: {
        root: workspaceRoot,
    },
    async rewrites() {
        if (process.env.NODE_ENV !== 'development') {
            return []
        }

        return {
            beforeFiles: [
                {
                    source: '/previews/:path*',
                    destination: `${previewOrigin}/previews/:path*`,
                },
            ],
            afterFiles: [],
            fallback: [],
        }
    },
}

export default createMDX()(nextConfig)
