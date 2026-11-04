import { useState } from 'react'
import type { ExampleDefinition } from '../examples/registry'
import { HighlightedCodeBlock } from './HighlightedCodeBlock'

export const ExampleCode = ({
    example,
}: {
    example: Pick<ExampleDefinition, 'source' | 'sourceFiles'>
}) => {
    const [sourceName, setSourceName] = useState<string>()
    const sources = example.sourceFiles ?? [
        { name: 'Example.tsx', code: example.source },
    ]
    const selectedSource =
        sources.find(({ name }) => name === sourceName) ?? sources[0]

    return (
        <>
            {sources.length > 1 && (
                <div
                    role="group"
                    aria-label="Source files"
                    className="flex flex-wrap gap-1 border-b border-border px-3 py-2"
                >
                    {sources.map(({ name }) => (
                        <button
                            key={name}
                            type="button"
                            aria-pressed={name === selectedSource.name}
                            onClick={() => setSourceName(name)}
                            className={[
                                'rounded-md px-2 py-1 font-mono text-xs transition-colors',
                                name === selectedSource.name
                                    ? 'bg-muted text-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            ].join(' ')}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            )}
            <HighlightedCodeBlock
                code={selectedSource.code}
                language="tsx"
                className="rounded-none border-0 border-t"
                contentClassName="max-h-[640px]"
            />
        </>
    )
}
