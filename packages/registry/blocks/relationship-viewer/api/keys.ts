import type { NodeRef } from '../domain/model'
import type { SeedQuery } from './fetchers'

export const relationshipViewerKeys = {
    all: ['relationship-viewer'] as const,
    metadata: () => ['relationship-viewer', 'metadata'] as const,
    node: (ref: NodeRef, program: string | undefined) =>
        [
            'relationship-viewer',
            'node',
            ref.kind,
            ref.id,
            program ?? null,
        ] as const,
    seeds: (query: SeedQuery) =>
        ['relationship-viewer', 'seeds', query] as const,
}
