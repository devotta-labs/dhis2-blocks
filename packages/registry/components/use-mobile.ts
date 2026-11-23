import * as React from 'react'

const MOBILE_BREAKPOINT = 768

/** shadcn useIsMobile: true while the window is narrower than Tailwind's `md`. */
export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState(false)

    React.useEffect(() => {
        const query = window.matchMedia(
            `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
        )
        const onChange = () => setIsMobile(query.matches)
        query.addEventListener('change', onChange)
        onChange()
        return () => query.removeEventListener('change', onChange)
    }, [])

    return isMobile
}
