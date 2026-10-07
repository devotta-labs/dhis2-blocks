import { toHtml } from 'hast-util-to-html'
import { common, createLowlight } from 'lowlight'
import { useMemo } from 'react'
import { CopyButton } from './CopyButton'

const lowlight = createLowlight(common)

const highlightToHtml = (source: string, language: string) => {
    try {
        return toHtml(lowlight.highlight(language, source))
    } catch {
        return undefined
    }
}

interface CodeBlockProps {
    code: string
    language?: string
    className?: string
}

export const CodeBlock = ({
    code,
    language = 'tsx',
    className,
}: CodeBlockProps) => {
    const html = useMemo(
        () => highlightToHtml(code, language),
        [code, language]
    )

    return (
        <figure
            className={[
                'relative overflow-hidden rounded-lg border border-border bg-muted',
                className,
            ].join(' ')}
        >
            <div className="absolute top-2 right-2 z-10">
                <CopyButton value={code} />
            </div>

            <div className="max-h-[640px] overflow-auto p-4">
                <pre className="font-mono text-[13px] leading-6">
                    {html ? (
                        <code
                            className="hljs"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    ) : (
                        <code>{code}</code>
                    )}
                </pre>
            </div>
        </figure>
    )
}
