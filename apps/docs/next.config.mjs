import path from 'node:path'
import { networkInterfaces } from 'node:os'
import { createMDX } from 'fumadocs-mdx/next'

const workspaceRoot = path.join(import.meta.dirname, '../..')
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
}

export default createMDX()(nextConfig)
