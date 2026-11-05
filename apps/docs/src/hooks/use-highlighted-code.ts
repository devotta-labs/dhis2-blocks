import * as React from 'react'

import { loadHighlighter } from '../lib/highlighter'

export function useHighlightedCode(value: string, language: string) {
    // A trailing newline would render as an extra empty line.
    const code = value.endsWith('\n') ? value.slice(0, -1) : value
    const [loaded, setLoaded] = React.useState<{
        language: string
        highlighter: Awaited<ReturnType<typeof loadHighlighter>>
    } | null>(null)
    const highlighter =
        loaded?.language === language ? loaded.highlighter : null

    React.useEffect(() => {
        let cancelled = false

        loadHighlighter(language)
            .then((next) => {
                if (!cancelled) {
                    setLoaded({ language, highlighter: next })
                }
            })
            .catch(() => {})

        return () => {
            cancelled = true
        }
    }, [language])

    return React.useMemo(
        () =>
            highlighter ? highlighter.highlight(code).lines : code.split('\n'),
        [code, highlighter]
    )
}
