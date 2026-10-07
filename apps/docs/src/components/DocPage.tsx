import type { ReactNode } from 'react'

interface DocPageProps {
    title?: string
    description?: string
    children: ReactNode
}

export const DocPage = ({ title, description, children }: DocPageProps) => (
    <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-primary prose-a:font-medium prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal">
        {title && (
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">
                {title}
            </h1>
        )}

        {description && (
            <p className="mb-8 text-lg text-muted-foreground">{description}</p>
        )}

        {children}
    </article>
)
