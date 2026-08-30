'use client'

import dynamic from 'next/dynamic'
import { PreviewLoading } from '@/components/previews/preview-shell'

const ContextSelectorBasicPreview = dynamic(
    () =>
        import('@/components/previews/context-selector-basic').then(
            (module) => module.ContextSelectorBasicPreview
        ),
    {
        ssr: false,
        loading: PreviewLoading,
    }
)

export function ContextSelectorBasicPreviewLoader() {
    return <ContextSelectorBasicPreview />
}
