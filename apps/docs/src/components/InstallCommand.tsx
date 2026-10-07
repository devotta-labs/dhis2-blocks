import { useMemo, useState } from 'react'
import { CopyButton } from './CopyButton'

const packageManagers = ['pnpm', 'npm', 'yarn', 'bun'] as const

type PackageManager = (typeof packageManagers)[number]

const getCommands = (item: string) => ({
    pnpm: `pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/${item}`,
    npm: `npx shadcn@latest add devotta-labs/dhis2-blocks/${item}`,
    yarn: `yarn dlx shadcn@latest add devotta-labs/dhis2-blocks/${item}`,
    bun: `bunx --bun shadcn@latest add devotta-labs/dhis2-blocks/${item}`,
})

export const InstallCommand = ({ item }: { item: string }) => {
    const commands = useMemo(() => getCommands(item), [item])
    const [manager, setManager] = useState<PackageManager>('pnpm')

    return (
        <figure className="not-prose relative my-4 overflow-hidden rounded-lg border border-border bg-muted">
            <div className="flex items-center border-b border-border px-3">
                <div className="flex items-center gap-1">
                    {packageManagers.map((name) => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => setManager(name)}
                            className={[
                                'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                                manager === name
                                    ? 'bg-background text-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            ].join(' ')}
                        >
                            {name}
                        </button>
                    ))}
                </div>

                <div className="ml-auto">
                    <CopyButton value={commands[manager]} />
                </div>
            </div>

            <div className="overflow-x-auto px-4 py-3">
                <pre className="font-mono text-sm leading-6">
                    <code>{commands[manager]}</code>
                </pre>
            </div>
        </figure>
    )
}
