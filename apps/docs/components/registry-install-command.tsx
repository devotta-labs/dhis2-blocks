import {
    Snippet,
    SnippetAddon,
    SnippetCopyButton,
    SnippetInput,
    SnippetText,
} from '@/components/ai-elements/snippet'

const fallbackOrigin = 'http://localhost:3002'

const getSiteOrigin = () => {
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim()
    return (configuredOrigin || fallbackOrigin).replace(/\/$/, '')
}

export function RegistryInstallCommand({ item }: { item: string }) {
    const command = `pnpm dlx shadcn@latest add ${getSiteOrigin()}/r/${item}.json`

    return (
        <Snippet code={command} className="my-4">
            <SnippetAddon>
                <SnippetText>$</SnippetText>
            </SnippetAddon>
            <SnippetInput aria-label="Installation command" />
            <SnippetAddon align="inline-end">
                <SnippetCopyButton />
            </SnippetAddon>
        </Snippet>
    )
}
