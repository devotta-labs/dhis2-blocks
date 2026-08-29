import { loader } from 'fumadocs-core/source'
import { defineDocs } from 'fumadocs-mdx/macro'
import { z } from 'zod'

const blocks = defineDocs({
    dir: 'content/blocks',
    docs: {
        schema: z.object({
            title: z.string().min(1),
            description: z.string().min(1),
        }),
    },
})

export const source = loader({
    baseUrl: '/blocks',
    source: blocks.toFumadocsSource(),
})
