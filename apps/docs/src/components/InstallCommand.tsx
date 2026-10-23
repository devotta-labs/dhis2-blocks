import { useState } from 'react'
import { useHighlightedCode } from '../hooks/use-highlighted-code'
import { Button } from './ui/button'
import {
    CodeBlock,
    CodeBlockActions,
    CodeBlockContent,
    CodeBlockCopyButton,
    CodeBlockHeader,
    CodeBlockLine,
} from './ui/code-block'

const packageManagers = ['pnpm', 'npm', 'yarn', 'bun'] as const

type PackageManager = (typeof packageManagers)[number]

type Commands = Record<PackageManager, string>

type Block = 'context-selector' | 'tracked-entity-record' | 'working-list'

const PackageManagerCommand = ({ commands }: { commands: Commands }) => {
    const [manager, setManager] = useState<PackageManager>('pnpm')
    const lines = useHighlightedCode(commands[manager], 'bash')

    return (
        <CodeBlock className="not-prose my-4">
            <CodeBlockHeader>
                <div className="flex items-center gap-1">
                    {packageManagers.map((name) => (
                        <Button
                            key={name}
                            variant="ghost"
                            size="xs"
                            aria-pressed={manager === name}
                            onClick={() => setManager(name)}
                            className="aria-pressed:bg-muted aria-pressed:text-foreground"
                        >
                            {name}
                        </Button>
                    ))}
                </div>
                <CodeBlockActions>
                    <CodeBlockCopyButton value={commands[manager]} />
                </CodeBlockActions>
            </CodeBlockHeader>
            <CodeBlockContent>
                {lines.map((line, index) => (
                    <CodeBlockLine key={index}>{line}</CodeBlockLine>
                ))}
            </CodeBlockContent>
        </CodeBlock>
    )
}

/** Adds npm packages to the project, as dev dependencies when `dev` is set. */
export const AddPackagesCommand = ({
    packages,
    dev = false,
}: {
    packages: string
    dev?: boolean
}) => {
    const flag = dev ? ' -D' : ''

    return (
        <PackageManagerCommand
            commands={{
                pnpm: `pnpm add${flag} ${packages}`,
                npm: `npm install${flag} ${packages}`,
                yarn: `yarn add${flag} ${packages}`,
                bun: `bun add${flag} ${packages}`,
            }}
        />
    )
}

/** A shadcn CLI command, shown for each package manager. */
export const ShadcnCommand = ({ args }: { args: string }) => (
    <PackageManagerCommand
        commands={{
            pnpm: `pnpm dlx shadcn@latest ${args}`,
            npm: `npx shadcn@latest ${args}`,
            yarn: `yarn dlx shadcn@latest ${args}`,
            bun: `bunx --bun shadcn@latest ${args}`,
        }}
    />
)

/** `shadcn add` for a block: copies its source and installs its dependencies. */
export const InstallCommand = ({ item }: { item: Block }) => (
    <ShadcnCommand args={`add devotta-labs/dhis2-blocks/${item}`} />
)
