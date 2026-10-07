import type { Props as MDXProviderProps } from '@mdx-js/react'
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

export const mdxComponents: NonNullable<MDXProviderProps['components']> = {
    a: DocsLink,
}
