import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { DocsShell } from '@/components/docs-shell'
import { source } from '@/lib/source'

export default function DocumentationShell({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <DocsShell>
            <DocsLayout
                tree={source.pageTree}
                nav={{ enabled: false }}
                sidebar={{ enabled: false }}
                tabs={false}
                containerProps={{
                    className:
                        '[--fd-docs-height:calc(100dvh-3.5rem)] min-h-(--fd-docs-height)',
                }}
            >
                {children}
            </DocsLayout>
        </DocsShell>
    )
}
