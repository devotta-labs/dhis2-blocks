import { useHighlightedCode } from '../hooks/use-highlighted-code'
import {
    CodeBlock,
    CodeBlockActions,
    CodeBlockContent,
    CodeBlockCopyButton,
    CodeBlockLine,
} from './ui/code-block'

interface HighlightedCodeBlockProps {
    code: string
    language: string
    className?: string
    contentClassName?: string
}

/** A shadcn code block with Shiki highlighting and a floating copy button. */
export const HighlightedCodeBlock = ({
    code,
    language,
    className,
    contentClassName,
}: HighlightedCodeBlockProps) => {
    const lines = useHighlightedCode(code, language)

    return (
        <CodeBlock className={className}>
            <CodeBlockActions>
                <CodeBlockCopyButton value={code.replace(/\n$/, '')} />
            </CodeBlockActions>
            <CodeBlockContent className={contentClassName}>
                {lines.map((line, index) => (
                    <CodeBlockLine key={index}>{line}</CodeBlockLine>
                ))}
            </CodeBlockContent>
        </CodeBlock>
    )
}
