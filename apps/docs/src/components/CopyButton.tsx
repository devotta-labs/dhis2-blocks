import { useCallback, useEffect, useRef, useState } from 'react'

export const CopyButton = ({ value }: { value: string }) => {
    const [copied, setCopied] = useState(false)
    const timeoutRef = useRef(0)

    const copy = useCallback(async () => {
        if (!navigator.clipboard?.writeText) {
            return
        }

        try {
            await navigator.clipboard.writeText(value)
            window.clearTimeout(timeoutRef.current)
            setCopied(true)
            timeoutRef.current = window.setTimeout(() => setCopied(false), 2000)
        } catch {
            setCopied(false)
        }
    }, [value])

    useEffect(
        () => () => {
            window.clearTimeout(timeoutRef.current)
        },
        []
    )

    return (
        <button
            type="button"
            onClick={copy}
            aria-label={copied ? 'Copied' : 'Copy to clipboard'}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100"
        >
            {copied ? (
                <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M20 6 9 17l-5-5" />
                </svg>
            ) : (
                <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <rect width="14" height="14" x="8" y="8" rx="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
            )}
        </button>
    )
}
