import type { MDXComponents } from 'mdx/types.js'
import {
    Children,
    isValidElement,
    type AnchorHTMLAttributes,
    type HTMLAttributes,
    type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { HighlightedCodeBlock } from './HighlightedCodeBlock'

const DocsLink = ({
    href = '',
    children,
    ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (href.startsWith('#')) {
        return (
            <a href={href} {...props}>
                {children}
            </a>
        )
    }

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

const textOf: (node: ReactNode) => string = (node) =>
    Children.toArray(node)
        .map((child) =>
            isValidElement<{ children?: ReactNode }>(child)
                ? textOf(child.props.children)
                : String(child)
        )
        .join('')

const slugify = (node: ReactNode) =>
    textOf(node)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

const H2 = ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2 id={slugify(children)} {...props}>
        {children}
    </h2>
)

const H3 = ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3 id={slugify(children)} {...props}>
        {children}
    </h3>
)

const Pre = ({ children, ...props }: HTMLAttributes<HTMLPreElement>) => {
    const [code] = Children.toArray(children)

    if (!isValidElement<{ className?: string; children?: ReactNode }>(code)) {
        return <pre {...props}>{children}</pre>
    }

    const language =
        /language-(\S+)/.exec(code.props.className ?? '')?.[1] ?? 'text'

    return (
        <HighlightedCodeBlock
            code={textOf(code.props.children)}
            language={language}
            className="not-prose my-6"
        />
    )
}

export const mdxComponents: MDXComponents = {
    a: DocsLink,
    h2: H2,
    h3: H3,
    pre: Pre,
}
