'use client'

import type { ComponentProps } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import type { PreviewSlug } from '@/components/previews/preview-registry'
import { cn } from '@/lib/utils'

const defaultContentSelector = '.preview-shell'
const defaultPreviewHeight = 730

interface PreviewProps extends Omit<
    ComponentProps<'iframe'>,
    'onLoad' | 'ref' | 'src' | 'title'
> {
    slug: PreviewSlug
    title: string
    contentSelector?: string
    defaultHeight?: number
}

export function Preview({
    slug,
    title,
    contentSelector = defaultContentSelector,
    defaultHeight = defaultPreviewHeight,
    className,
    style,
    ...props
}: PreviewProps) {
    const frameRef = useRef<HTMLIFrameElement>(null)
    const resizeObserverRef = useRef<ResizeObserver>(null)
    const mutationObserverRef = useRef<MutationObserver>(null)
    const observedContentRef = useRef<Element>(null)

    const syncFrameHeight = useCallback(() => {
        const frame = frameRef.current
        const previewDocument = frame?.contentDocument

        if (!frame || !previewDocument) {
            return
        }

        const previewContent = previewDocument.querySelector(contentSelector)
        const height = previewContent
            ? previewContent.getBoundingClientRect().height
            : previewDocument.documentElement.scrollHeight

        frame.style.height = `${Math.ceil(height)}px`
    }, [contentSelector])

    const handleLoad = useCallback(() => {
        const previewDocument = frameRef.current?.contentDocument

        resizeObserverRef.current?.disconnect()
        mutationObserverRef.current?.disconnect()
        observedContentRef.current = null

        if (!previewDocument?.body) {
            return
        }

        const resizeObserver = new ResizeObserver(syncFrameHeight)
        const observePreviewContent = () => {
            const previewContent =
                previewDocument.querySelector(contentSelector)

            if (previewContent === observedContentRef.current) {
                syncFrameHeight()
                return
            }

            resizeObserver.disconnect()
            observedContentRef.current = previewContent

            if (previewContent) {
                resizeObserver.observe(previewContent)
            }

            syncFrameHeight()
        }

        resizeObserverRef.current = resizeObserver
        mutationObserverRef.current = new MutationObserver(
            observePreviewContent
        )
        mutationObserverRef.current.observe(previewDocument.body, {
            childList: true,
            subtree: true,
        })

        observePreviewContent()
        syncFrameHeight()
    }, [contentSelector, syncFrameHeight])

    useEffect(
        () => () => {
            resizeObserverRef.current?.disconnect()
            mutationObserverRef.current?.disconnect()
            observedContentRef.current = null
        },
        []
    )

    return (
        <iframe
            ref={frameRef}
            src={`/previews/${slug}`}
            title={title}
            className={cn('block w-full bg-fd-card', className)}
            style={{ height: defaultHeight, ...style }}
            onLoad={handleLoad}
            {...props}
        />
    )
}
