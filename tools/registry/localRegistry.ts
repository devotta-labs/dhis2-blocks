import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registryItemSchema, registrySchema } from 'shadcn/schema'

const ADDRESS_PREFIX = 'devotta-labs/dhis2-blocks/'

export const prepareLocalRegistry = (directory: string) => {
    const catalog = registrySchema.parse(
        JSON.parse(readFileSync(join(directory, 'registry.json'), 'utf8'))
    )
    const paths = new Map(
        catalog.items.map((item) => [
            item.name,
            join(directory, `${item.name}.json`),
        ])
    )

    return [...paths.values()].map((path) => {
        const item = registryItemSchema.parse(
            JSON.parse(readFileSync(path, 'utf8'))
        )

        // GitHub dependency refs are not inherited: test this checkout, not main.
        item.registryDependencies = item.registryDependencies?.map(
            (dependency) => {
                if (!dependency.startsWith(ADDRESS_PREFIX)) return dependency

                const local = paths.get(dependency.slice(ADDRESS_PREFIX.length))
                if (!local)
                    throw new Error(
                        `Missing local registry dependency: ${dependency}`
                    )
                return local
            }
        )
        writeFileSync(path, JSON.stringify(item, null, 2))
        return item
    })
}
