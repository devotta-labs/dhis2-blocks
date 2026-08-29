import type { Metadata } from 'next'
import {
    DocsDescription,
    DocsPage,
    DocsTitle,
} from 'fumadocs-ui/layouts/docs/page'

export const metadata: Metadata = { title: 'Components' }

export default function ComponentsPage() {
    return (
        <DocsPage
            toc={[]}
            breadcrumb={{ enabled: false }}
            footer={{ enabled: false }}
        >
            <DocsTitle>Components</DocsTitle>
            <DocsDescription className="text-base">
                Component documentation will be added in a future release.
            </DocsDescription>
        </DocsPage>
    )
}
