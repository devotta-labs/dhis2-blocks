import { Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getExample } from '../examples/registry'
import { LivePreviewHost } from './LivePreviewHost'
import { PreviewShell, PreviewSpinner } from './PreviewShell'

/**
 * Standalone preview route (`/preview/*`).
 *
 * The full-screen target for each example card's "Open full screen" link;
 * documentation pages render the same component inline via `ExampleSurface`,
 * so this route and the cards share component, adapter, placeholder, and query
 * cache semantics.
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

    const Placeholder = example.Placeholder ?? PreviewSpinner

    // The shell sits inside the adapter so the adapter keeps the full viewport.
    const placeholder = (
        <PreviewShell>
            <Placeholder />
        </PreviewShell>
    )

    const content = (
        <Suspense fallback={placeholder}>
            <PreviewShell>
                <example.Component />
            </PreviewShell>
        </Suspense>
    )

    return example.live ? (
        <LivePreviewHost placeholder={placeholder}>{content}</LivePreviewHost>
    ) : (
        content
    )
}
