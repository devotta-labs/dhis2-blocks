import { Suspense } from 'react'
import type { ExampleDefinition } from '../examples/registry'
import { LivePreviewHost } from './LivePreviewHost'
import { PreviewSpinner, previewShellClassName } from './PreviewShell'

/**
 * Inline example surface used by the docs-page cards.
 *
 * The example mounts inside the documentation page itself — same DOM, same
 * query providers, same adapter — so the preview reads as part of the page
 * rather than an embedded frame. `minHeight` reserves the loaded height up
 * front, so data arriving never reshapes the card. DHIS2 dialogs and
 * popovers portal to `document.body`, which lets them overlay the page
 * exactly as they do on the standalone `/preview/:slug` route.
 */
export const ExampleSurface = ({
    example,
    className,
}: {
    example: ExampleDefinition
    className?: string
}) => {
    const content = (
        <Suspense fallback={<PreviewSpinner />}>
            <example.Component />
        </Suspense>
    )

    return (
        <div
            className={[previewShellClassName, className]
                .filter(Boolean)
                .join(' ')}
            style={{ minHeight: example.minHeight }}
        >
            {example.live ? (
                <LivePreviewHost>{content}</LivePreviewHost>
            ) : (
                content
            )}
        </div>
    )
}
