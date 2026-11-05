import { join } from 'node:path'

export const REPO_ROOT = join(import.meta.dirname, '..', '..')
export const registryLayout = (repoRoot = REPO_ROOT) => {
    const source = join(repoRoot, 'packages', 'registry')
    return {
        source,
        components: join(source, 'components'),
        blocks: join(source, 'blocks'),
    }
}
export const ADDRESS_PREFIX = 'devotta-labs/dhis2-blocks/'
export const COMPONENT_IMPORT = '@/components/dhis2/ui/'
export const COMPONENT_TARGET = '@components/dhis2/ui/'
export const BLOCK_IMPORT = '@/components/'
export const BLOCK_TARGET = '@components/'

// Specific UI addresses must resolve before the broad block address.
export const registryAliases = () => {
    const layout = registryLayout()
    return [
        { find: COMPONENT_IMPORT.slice(0, -1), replacement: layout.components },
        { find: BLOCK_IMPORT.slice(0, -1), replacement: layout.blocks },
    ]
}
