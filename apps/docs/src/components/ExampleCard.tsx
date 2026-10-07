import { useState } from 'react'
import { getExample, type ExampleSlug } from '../examples/registry'
import { ExampleSurface } from '../preview/ExampleSurface'
import { CodeBlock } from './CodeBlock'

/**
 * Preview/Code card for a registered example.
 *
 * The preview mounts inline inside the page (same DOM and providers as the
 * standalone `/preview/:slug` route), so the card reads as part of the
 * documentation rather than an embedded frame; its reserved height means
 * loading never reshapes it. The Code tab renders the raw example module —
 * the exact source the preview executes.
 */
export const ExampleCard = ({ slug }: { slug: ExampleSlug }) => {
    const example = getExample(slug)

    const [tab, setTab] = useState<'preview' | 'code'>('preview')

    if (!example) {
        return null
    }

    return (
        <div className="not-prose overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center gap-1 border-b border-border px-3 py-2">
                <div
                    role="tablist"
                    aria-label={`${example.title} example`}
                    className="flex items-center gap-1"
                >
                    {(['preview', 'code'] as const).map((name) => (
                        <button
                            key={name}
                            type="button"
                            role="tab"
                            aria-selected={tab === name}
                            onClick={() => setTab(name)}
                            className={[
                                'rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                                tab === name
                                    ? 'bg-muted text-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            ].join(' ')}
                        >
                            {name}
                        </button>
                    ))}
                </div>

                <a
                    href={`/preview/${example.slug}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <svg
                        viewBox="0 0 24 24"
                        className="size-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    </svg>
                    Open full screen
                </a>
            </div>

            <div role="tabpanel" hidden={tab !== 'preview'}>
                <ExampleSurface example={example} />
            </div>

            <div role="tabpanel" hidden={tab !== 'code'}>
                <CodeBlock
                    code={example.source}
                    language="tsx"
                    className="rounded-none border-0 border-t border-border"
                />
            </div>
        </div>
    )
}
