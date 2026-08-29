'use client'

import { Tabs } from '@base-ui/react/tabs'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const fallbackOrigin = 'http://localhost:3002'
const packageManagers = ['pnpm', 'npm', 'yarn', 'bun'] as const

type PackageManager = (typeof packageManagers)[number]

const getSiteOrigin = () => {
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim()
    return (configuredOrigin || fallbackOrigin).replace(/\/$/, '')
}

const getCommands = (item: string) => {
    const registryItem = `${getSiteOrigin()}/r/${item}.json`

    return {
        pnpm: `pnpm dlx shadcn@latest add ${registryItem}`,
        npm: `npx shadcn@latest add ${registryItem}`,
        yarn: `yarn dlx shadcn@latest add ${registryItem}`,
        bun: `bunx --bun shadcn@latest add ${registryItem}`,
    } satisfies Record<PackageManager, string>
}

export function RegistryInstallCommand({ item }: { item: string }) {
    const commands = useMemo(() => getCommands(item), [item])
    const [packageManager, setPackageManager] = useState<PackageManager>('pnpm')
    const [isCopied, setIsCopied] = useState(false)
    const copyTimeoutRef = useRef<number>(0)

    const handlePackageManagerChange = useCallback((value: PackageManager) => {
        window.clearTimeout(copyTimeoutRef.current)
        setIsCopied(false)
        setPackageManager(value)
    }, [])

    const copyCommand = useCallback(async () => {
        if (!navigator.clipboard?.writeText) {
            return
        }

        try {
            await navigator.clipboard.writeText(commands[packageManager])
            window.clearTimeout(copyTimeoutRef.current)
            setIsCopied(true)
            copyTimeoutRef.current = window.setTimeout(
                () => setIsCopied(false),
                2000
            )
        } catch {
            setIsCopied(false)
        }
    }, [commands, packageManager])

    useEffect(
        () => () => {
            window.clearTimeout(copyTimeoutRef.current)
        },
        []
    )

    return (
        <figure className="relative my-4 overflow-hidden rounded-2xl bg-muted not-prose">
            <Tabs.Root
                value={packageManager}
                onValueChange={handlePackageManagerChange}
                className="flex flex-col gap-0"
            >
                <div className="flex items-center border-b border-border/50 px-3 py-1">
                    <Tabs.List className="inline-flex h-9 w-fit items-center justify-center rounded-none bg-transparent p-0 text-muted-foreground">
                        {packageManagers.map((manager) => (
                            <Tabs.Tab
                                key={manager}
                                value={manager}
                                className={cn(
                                    'h-7 rounded-md border border-transparent px-2 pt-0.5 pb-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all outline-none',
                                    'hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                                    'data-active:border-input data-active:bg-background data-active:text-foreground'
                                )}
                            >
                                {manager}
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>
                </div>

                <div className="no-scrollbar overflow-x-auto">
                    {packageManagers.map((manager) => (
                        <Tabs.Panel
                            key={manager}
                            value={manager}
                            className="mt-0 flex-1 px-4 py-3.5 outline-none"
                        >
                            <pre>
                                <code className="relative font-mono text-sm leading-none">
                                    {commands[manager]}
                                </code>
                            </pre>
                        </Tabs.Panel>
                    ))}
                </div>
            </Tabs.Root>

            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-slot="copy-button"
                className="absolute top-2 right-2 z-10 rounded-md opacity-70 hover:opacity-100 focus-visible:opacity-100"
                onClick={copyCommand}
            >
                <span className="sr-only">Copy</span>
                {isCopied ? <CheckIcon /> : <CopyIcon />}
            </Button>
        </figure>
    )
}
