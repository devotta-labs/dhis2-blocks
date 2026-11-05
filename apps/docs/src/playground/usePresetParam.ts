import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * The lab's preset in the URL (`?preset=`), so a link opens the same case. Lab data only. A lab reads it once, to open
 * on that preset, and writes it whenever its preset changes: a preset's name, or nothing once a setting is changed by
 * hand.
 */
export const usePresetParam = () => {
    const [params, setParams] = useSearchParams()
    const current = params.get('preset') ?? undefined
    const [initial] = useState(current)
    const setPreset = useCallback(
        (name: string | undefined) => {
            if (current === name) return
            setParams(
                (previous) => {
                    const next = new URLSearchParams(previous)
                    if (name) next.set('preset', name)
                    else next.delete('preset')
                    return next
                },
                { replace: true }
            )
        },
        [current, setParams]
    )
    return [initial, setPreset] as const
}
