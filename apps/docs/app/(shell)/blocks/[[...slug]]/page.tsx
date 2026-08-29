import { notFound } from 'next/navigation'
import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle,
} from 'fumadocs-ui/layouts/docs/page'
import { getMDXComponents } from '@/components/mdx'
import { source } from '@/lib/source'

interface PageProps {
    params: Promise<{ slug?: string[] }>
}

export default async function BlockPage({ params }: PageProps) {
    const { slug } = await params
    const page = source.getPage(slug)

    if (!page) {
        notFound()
    }

    const MDX = page.data.body

    return (
        <DocsPage
            toc={page.data.toc}
            breadcrumb={{ enabled: false }}
            footer={{ enabled: false }}
            tableOfContent={{ list: { thumbBox: false } }}
            tableOfContentPopover={{ list: { thumbBox: false } }}
        >
            <DocsTitle>{page.data.title}</DocsTitle>
            <DocsDescription
                className={page.data.compactIntro ? 'text-base' : undefined}
            >
                {page.data.description}
            </DocsDescription>
            <DocsBody
                className={
                    page.data.compactIntro
                        ? '[&>p:first-child]:text-sm'
                        : undefined
                }
            >
                <MDX components={getMDXComponents()} />
            </DocsBody>
        </DocsPage>
    )
}

export function generateStaticParams() {
    return source.generateParams()
}
