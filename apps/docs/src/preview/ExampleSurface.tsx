import { Suspense } from 'react'
import type { ExampleDefinition } from '../examples/registry'
import { LivePreviewHost } from './LivePreviewHost'
import { PreviewSpinner, previewShellClassName } from './PreviewShell'

/**
 * Inline example surface used by the docs-page cards.
 *
 * The example mounts inside the documentation page itself — same DOM, same
 * query providers, same adapter — so the preview reads as part of the page
 * rather than an embedded frame. `minHeight` reserves space while loading;
 * the surface grows with its content. It owns the inline padding and
 * constrains the adapter to the card instead of the browser viewport.
 * DHIS2 dialogs and popovers still portal to `document.body`.
 *
 * The example's `Placeholder` covers every phase before it renders — the
 * adapter starting the session and the lazy example chunk loading — so the
 * card keeps one placeholder until the example takes over.
 */

export const ExampleSurface = ({
    example,
    className,
}: {
    example: ExampleDefinition
    className?: string
}) => {
    const Placeholder = example.Placeholder ?? PreviewSpinner

    const content = (
        <Suspense fallback={<Placeholder />}>
            <example.Component />
        </Suspense>
    )

    return (
        <div
            className={[
                'docs-preview-surface relative min-w-0',
                previewShellClassName,
                className,
            ]
                .filter(Boolean)
                .join(' ')}
            style={{ minHeight: example.minHeight }}
        >
            {example.live ? (
                <LivePreviewHost placeholder={<Placeholder />}>
                    {content}
                </LivePreviewHost>
            ) : (
                content
            )}
        </div>
    )
}
