import type { MDXComponents } from 'mdx/types.js'
import type { AnchorHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

const DocsLink = ({
    href = '',
    children,
    ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (href.startsWith('/')) {
        return (
            <Link to={href} {...props}>
                {children}
            </Link>
        )
    }

    return (
        <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
            {children}
        </a>
    )
}

export const mdxComponents: MDXComponents = {
    a: DocsLink,
}
