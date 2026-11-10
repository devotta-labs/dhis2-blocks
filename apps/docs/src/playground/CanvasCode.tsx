import {
    Children,
    cloneElement,
    isValidElement,
    useId,
    useMemo,
    type ReactNode,
} from 'react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/dhis2/ui/tooltip'
import { HighlightedCodeBlock } from '../components/HighlightedCodeBlock'
import { propValue, type CanvasSource } from './canvasSource'

const PropTooltip = ({
    label,
    value,
    children,
}: {
    label: string
    value: string
    children: ReactNode
}) => {
    const id = useId()
    return (
        <Tooltip>
            <TooltipTrigger
                aria-label={`Inspect ${label}`}
                aria-describedby={id}
                className="cursor-help border-0 bg-transparent p-0 font-[inherit] text-inherit underline decoration-dotted decoration-muted-foreground underline-offset-4 hover:decoration-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
                {children}
            </TooltipTrigger>
            <TooltipContent
                id={id}
                role="tooltip"
                className="max-w-[min(28rem,calc(100vw-2rem))] px-3 py-2"
            >
                <span className="mb-1 block font-mono text-xs text-dhis2-background/60">
                    {label}
                </span>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                    {value}
                </pre>
            </TooltipContent>
        </Tooltip>
    )
}

/** Slice highlighted text without discarding its syntax colors. */
const sliceLine = (line: ReactNode, start: number, end: number) => {
    let offset = 0
    return Children.toArray(line).flatMap((token, index) => {
        const content = isValidElement<{ children: string }>(token)
            ? token.props.children
            : String(token)
        const text = content.slice(
            Math.max(0, start - offset),
            Math.max(0, end - offset)
        )
        offset += content.length
        if (!text) return []
        return [
            isValidElement(token)
                ? cloneElement(token, { key: index }, text)
                : text,
        ]
    })
}

export const CanvasCode = ({ source }: { source: CanvasSource }) => {
    const lines = useMemo(() => {
        let start = 0
        return source.code
            .replace(/\n$/, '')
            .split('\n')
            .map((text) => {
                const line = { start, end: start + text.length }
                start += text.length + 1
                return line
            })
    }, [source.code])
    const references = source.references.flatMap((reference) => {
        const value = propValue(source, reference)
        return value === undefined ? [] : [{ ...reference, value }]
    })

    const renderLine = (line: ReactNode, index: number) => {
        const { start, end } = lines[index]
        const props = references.filter(
            (reference) => reference.start < end && reference.end > start
        )
        if (props.length === 0) return line
        const parts: ReactNode[] = []
        let cursor = 0
        for (const reference of props) {
            const from = Math.max(0, reference.start - start)
            const to = Math.min(end, reference.end) - start
            parts.push(...sliceLine(line, cursor, from))
            const label = source.code.slice(reference.start, reference.end)
            parts.push(
                <PropTooltip
                    key={reference.start}
                    label={label}
                    value={reference.value}
                >
                    {sliceLine(line, from, to)}
                </PropTooltip>
            )
            cursor = to
        }
        parts.push(...sliceLine(line, cursor, end - start))
        return parts
    }

    return (
        <TooltipProvider delay={200}>
            <HighlightedCodeBlock
                code={source.code}
                language="tsx"
                renderLine={renderLine}
                className="h-full min-h-0 rounded-none border-0"
                contentClassName="flex-1 p-4 pe-12 text-xs md:p-6 md:pe-14"
            />
        </TooltipProvider>
    )
}
