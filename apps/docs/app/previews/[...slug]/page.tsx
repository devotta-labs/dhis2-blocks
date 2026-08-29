import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
    getPreview,
    previewSlugs,
} from '@/components/previews/preview-registry'

interface PreviewPageProps {
    params: Promise<{ slug: string[] }>
}

export function generateStaticParams() {
    return previewSlugs.map((slug) => ({ slug: slug.split('/') }))
}

export async function generateMetadata({
    params,
}: PreviewPageProps): Promise<Metadata> {
    const { slug } = await params
    const preview = getPreview(slug.join('/'))

    return {
        title: preview?.title ?? 'Preview not found',
        robots: { index: false, follow: false },
    }
}

export default async function PreviewPage({ params }: PreviewPageProps) {
    const { slug } = await params
    const preview = getPreview(slug.join('/'))

    if (!preview) {
        notFound()
    }

    const PreviewComponent = preview.component

    return <PreviewComponent />
}
