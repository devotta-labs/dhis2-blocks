import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface DocPageProps {
    title?: string
    description?: string
    children: ReactNode
}

// Pages load lazily, so the browser cannot jump to a #section on navigation;
// scroll once the page content exists.
const useScrollToHash = () => {
    const { hash } = useLocation()

    useEffect(() => {
        if (!hash) {
            return
        }

        // A malformed percent escape makes decodeURIComponent throw; leave the
        // page up instead of failing it.
        let id: string

        try {
            id = decodeURIComponent(hash.slice(1))
        } catch {
            return
        }

        document.getElementById(id)?.scrollIntoView()
    }, [hash])
}

export const DocPage = ({ title, description, children }: DocPageProps) => {
    useScrollToHash()

    return (
        <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-primary prose-a:font-medium prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal">
            {title && (
                <h1 className="mb-2 text-3xl font-semibold tracking-tight">
                    {title}
                </h1>
            )}

            {description && (
                <p className="mb-8 text-lg text-muted-foreground">
                    {description}
                </p>
            )}

            {children}
        </article>
    )
}
