declare module '*.mdx' {
    import type { ComponentType, ReactNode } from 'react'

    export const frontmatter: {
        title?: string
        description?: string
    }

    const MDXComponent: ComponentType<{ children?: ReactNode }>

    export default MDXComponent
}

declare module 'mdx/types' {
    import type { ComponentType } from 'react'

    export type MDXComponents = Record<
        string,
        ComponentType<Record<string, unknown>>
    >
}

declare module 'mdx/types.js' {
    import type { ComponentType } from 'react'

    export type MDXComponents = Record<
        string,
        ComponentType<Record<string, unknown>>
    >
}
