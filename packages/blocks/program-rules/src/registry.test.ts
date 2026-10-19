import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const RegistrySchema = z.object({
    items: z.array(
        z.object({
            name: z.string(),
            type: z.string(),
            dependencies: z.array(z.string()),
            registryDependencies: z.array(z.string()).optional(),
            files: z.array(
                z.object({
                    path: z.string(),
                    type: z.string(),
                    target: z.string(),
                })
            ),
        })
    ),
})

const packageDirectory = join(import.meta.dirname, '..')
const registry = RegistrySchema.parse(
    JSON.parse(readFileSync(join(packageDirectory, 'registry.json'), 'utf8'))
)
const shippedFiles = (directory: string) =>
    readdirSync(join(packageDirectory, 'src', directory))
        .filter((file) => file.endsWith('.ts') && !file.includes('.test.'))
        .map((file) => `src/${directory}/${file}`)
        .sort()
const item = (name: string) => {
    const found = registry.items.find((candidate) => candidate.name === name)
    if (found === undefined) {
        throw new Error(`registry.json has no ${name} item`)
    }
    return found
}

describe('registry.json', () => {
    it('ships every lib file as the program-rules lib', () => {
        const lib = item('program-rules')
        expect(lib.type).toBe('registry:lib')
        expect(lib.files.map((file) => file.path).sort()).toEqual(
            shippedFiles('lib')
        )
        for (const file of lib.files) {
            expect(file).toEqual({
                path: file.path,
                type: 'registry:lib',
                target: file.path.replace('src/lib/', '@lib/program-rules/'),
            })
        }
    })

    it('ships every hook file as the use-program-rules hook', () => {
        const hook = item('use-program-rules')
        expect(hook.type).toBe('registry:hook')
        expect(hook.registryDependencies).toEqual([
            'devotta-labs/dhis2-blocks/program-rules',
        ])
        expect(hook.files.map((file) => file.path).sort()).toEqual(
            shippedFiles('hooks')
        )
        for (const file of hook.files) {
            expect(file).toEqual({
                path: file.path,
                type: 'registry:hook',
                target: file.path.replace(
                    'src/hooks/',
                    '@hooks/use-program-rules/'
                ),
            })
        }
    })

    it('pins the dependencies to the versions in package.json', () => {
        const manifest = z
            .object({ dependencies: z.record(z.string(), z.string()) })
            .parse(
                JSON.parse(
                    readFileSync(join(packageDirectory, 'package.json'), 'utf8')
                )
            )
        for (const entry of registry.items.flatMap((i) => i.dependencies)) {
            const at = entry.lastIndexOf('@')
            const name = entry.slice(0, at)
            const version = entry.slice(at + 1)
            if (name === 'react') {
                continue
            }
            expect(manifest.dependencies[name], name).toBe(version)
        }
    })
})
