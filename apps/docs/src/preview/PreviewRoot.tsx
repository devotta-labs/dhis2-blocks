import { Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getExample } from '../examples/registry'
import { LivePreviewHost } from './LivePreviewHost'
import { PreviewLoading, PreviewShell } from './PreviewShell'

/**
 * Standalone preview route (`/preview/:slug`).
 *
 * Documentation pages embed this route in a same-origin iframe and link to it
 * for full-screen viewing. Rendering happens here — never inline in a docs
 * page — so DHIS2 global CSS, fonts, portals, and dialogs stay contained.
 */
export const PreviewRoot = () => {
    const { slug } = useParams<{ slug: string }>()
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
