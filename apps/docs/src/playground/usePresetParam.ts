import { useSearchParams } from 'react-router-dom'

/**
 * The lab's preset in the URL (`?preset=`), so a link opens the same case. Lab data only. A lab reads it once, over its saved
 * settings, and writes it on every change: a preset's name, or nothing once a setting is changed by hand.
 */
export const usePresetParam = () => {
    const [params, setParams] = useSearchParams()
    const setPreset = (name: string | undefined) => {
        if ((params.get('preset') ?? undefined) === name) return
        setParams(
            (previous) => {
                const next = new URLSearchParams(previous)
                if (name) next.set('preset', name)
                else next.delete('preset')
                return next
            },
            { replace: true }
        )
    }
    return [params.get('preset') ?? undefined, setPreset] as const
}
