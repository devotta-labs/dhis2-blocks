import type { Metadata } from 'next'
import {
    DocsDescription,
    DocsPage,
    DocsTitle,
} from 'fumadocs-ui/layouts/docs/page'

export const metadata: Metadata = { title: 'Examples' }

export default function ExamplesPage() {
    return (
        <DocsPage
            toc={[]}
            breadcrumb={{ enabled: false }}
            footer={{ enabled: false }}
        >
            <DocsTitle>Examples</DocsTitle>
            <DocsDescription className="text-base">
                Application examples will be added in a future release.
            </DocsDescription>
        </DocsPage>
    )
}
