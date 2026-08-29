import type { ComponentType } from 'react'
import { WorkingListBasicPreviewLoader } from '@/components/previews/working-list-basic-loader'

interface PreviewDefinition {
    title: string
    component: ComponentType
}

const previewEntries = [
    [
        'working-list/basic',
        {
            title: 'Basic Working List preview',
            component: WorkingListBasicPreviewLoader,
        },
    ],
] as const satisfies readonly (readonly [string, PreviewDefinition])[]

export type PreviewSlug = (typeof previewEntries)[number][0]

export const previewSlugs: PreviewSlug[] = previewEntries.map(([slug]) => slug)

export const previewRegistry = new Map<string, PreviewDefinition>(
    previewEntries
)

export function getPreview(slug: string) {
    return previewRegistry.get(slug)
}
