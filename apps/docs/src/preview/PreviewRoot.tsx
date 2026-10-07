import { Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getExample } from '../examples/registry'
import { LivePreviewHost } from './LivePreviewHost'
import { PreviewLoading, PreviewShell } from './PreviewShell'

/**
 * Standalone preview route (`/preview/*`).
 *
 * The full-screen target for each example card's "Open full screen" link;
 * documentation pages render the same component inline via `ExampleSurface`,
 * so this route and the cards share component, adapter, and query cache
 * semantics.
 */
export const PreviewRoot = () => {
    const { '*': slug } = useParams()
    const example = slug ? getExample(slug) : undefined

    if (!example) {
        return (
            <PreviewShell className="flex flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-[#5f6b7a]">
                    Unknown preview: <code>{slug}</code>
                </p>
                <Link
                    to="/"
                    className="text-sm font-medium text-[#2c6693] underline-offset-4 hover:underline"
                >
                    Back to documentation
                </Link>
            </PreviewShell>
        )
    }

    const content = (
        <Suspense fallback={<PreviewLoading />}>
            <example.Component />
        </Suspense>
    )

    return example.live ? <LivePreviewHost>{content}</LivePreviewHost> : content
}
