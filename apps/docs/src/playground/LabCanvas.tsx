import { Tabs } from '@base-ui/react/tabs'
import { Code2, PanelsTopLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { HighlightedCodeBlock } from '../components/HighlightedCodeBlock'
import { type CanvasSource, sourceFile } from './canvasSource'

const CodeView = ({ source }: { source: CanvasSource }) => {
    const [file, setFile] = useState<'composition' | 'props'>('composition')
    const { code, language } = sourceFile(source, file)

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
                <select
                    aria-label="Code file"
                    value={file}
                    onChange={(event) =>
                        setFile(
                            event.target.value === 'props'
                                ? 'props'
                                : 'composition'
                        )
                    }
                    className="min-w-0 rounded-md border border-input bg-background px-2 py-1 font-mono text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                    <option value="composition">{source.name}</option>
                    <option value="props">Current props.json</option>
                </select>
                <span>
                    {file === 'props'
                        ? 'Current inputs · callbacks omitted from JSON'
                        : 'Read-only · playground providers supplied separately'}
                </span>
            </div>
            <HighlightedCodeBlock
                code={code}
                language={language}
                className="min-h-0 flex-1 rounded-none border-0"
                contentClassName="flex-1 p-4 pe-12 text-xs md:p-6 md:pe-14"
            />
        </div>
    )
}

export const LabCanvas = ({
    source,
    children,
}: {
    source: CanvasSource
    children: ReactNode
}) => (
    <Tabs.Root
        defaultValue="canvas"
        render={<section aria-label="Canvas preview" />}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
        <Tabs.List
            aria-label="Canvas view"
            className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2"
        >
            {(
                [
                    ['canvas', 'Canvas', PanelsTopLeft],
                    ['code', 'Code', Code2],
                ] as const
            ).map(([value, label, Icon]) => (
                <Tabs.Tab
                    key={value}
                    value={value}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-active:bg-muted data-active:text-foreground"
                >
                    <Icon aria-hidden="true" className="size-3.5" />
                    {label}
                </Tabs.Tab>
            ))}
        </Tabs.List>
        {/* Keep the block and its query cache alive while inspecting its source. */}
        <Tabs.Panel
            value="canvas"
            keepMounted
            className="lab-graticule relative min-h-0 flex-1 overflow-auto"
        >
            <div className="docs-preview-surface flex flex-col gap-3 p-3 [font-family:Roboto,Helvetica,Arial,sans-serif] text-dhis2-grey-900 [color-scheme:light] md:p-6">
                {children}
            </div>
        </Tabs.Panel>
        <Tabs.Panel value="code" className="min-h-0 flex-1 overflow-hidden">
            <CodeView source={source} />
        </Tabs.Panel>
    </Tabs.Root>
)
