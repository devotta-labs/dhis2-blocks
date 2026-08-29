'use client'

import dynamic from 'next/dynamic'
import { PreviewLoading } from '@/components/previews/preview-shell'

const WorkingListBasicPreview = dynamic(
    () =>
        import('@/components/previews/working-list-basic').then(
            (module) => module.WorkingListBasicPreview
        ),
    {
        ssr: false,
        loading: PreviewLoading,
    }
)

export function WorkingListBasicPreviewLoader() {
    return <WorkingListBasicPreview />
}
