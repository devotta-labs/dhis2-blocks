import { useCallback, useEffect, useRef, useState } from 'react'
import { getExample, type ExampleSlug } from '../examples/registry'
import { CodeBlock } from './CodeBlock'

const contentSelector = '.docs-preview-shell'

/**
 * Preview/Code card for a registered example.
 *
 * The preview is rendered by the `/preview/:slug` route inside a same-origin
 * iframe, which keeps DHIS2 global styles, fonts, portals, and dialogs out of
 * the documentation DOM. The Code tab renders the raw example module — the
 * exact source the preview executes.
 */
export const ExampleCard = ({ slug }: { slug: ExampleSlug }) => {
    const example = getExample(slug)

    const [tab, setTab] = useState<'preview' | 'code'>('preview')
    const frameRef = useRef<HTMLIFrameElement>(null)

    const observersRef = useRef<{
        resize?: ResizeObserver
        mutation?: MutationObserver
        content?: Element | null
    }>({})

    const syncFrameHeight = useCallback(() => {
        const frame = frameRef.current
        const previewDocument = frame?.contentDocument

        if (!frame || !previewDocument) {
            return
        }

        const content = previewDocument.querySelector(contentSelector)

        const height = content
            ? content.getBoundingClientRect().height
            : previewDocument.documentElement.scrollHeight

        frame.style.height = `${Math.ceil(height)}px`
    }, [])

    const handleLoad = useCallback(() => {
        const previewDocument = frameRef.current?.contentDocument
        const observers = observersRef.current

        observers.resize?.disconnect()
        observers.mutation?.disconnect()
        observers.content = null

        if (!previewDocument?.body) {
            return
        }

        const resizeObserver = new ResizeObserver(syncFrameHeight)

        const observeContent = () => {
            const content = previewDocument.querySelector(contentSelector)

            if (content === observers.content) {
                syncFrameHeight()

                return
            }

            resizeObserver.disconnect()
            observers.content = content

            if (content) {
                resizeObserver.observe(content)
            }

            syncFrameHeight()
        }

        observers.resize = resizeObserver
        observers.mutation = new MutationObserver(observeContent)
        observers.mutation.observe(previewDocument.body, {
            childList: true,
            subtree: true,
        })

        observeContent()
        syncFrameHeight()
    }, [syncFrameHeight])

    useEffect(
        () => () => {
            observersRef.current.resize?.disconnect()
            observersRef.current.mutation?.disconnect()
        },
        []
    )

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
                <iframe
                    ref={frameRef}
                    src={`/preview/${example.slug}`}
                    title={example.title}
                    onLoad={handleLoad}
                    className="block w-full bg-background"
                    style={{ height: example.defaultHeight }}
                />
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
