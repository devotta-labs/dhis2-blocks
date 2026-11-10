import { useEffect } from 'react'

/** While `armed`, leaving or closing the page shows the browser's own "leave this page?" prompt. */
export const useLeaveWarning = (armed: boolean) => {
    useEffect(() => {
        if (!armed) {
            return
        }
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            // Browsers older than the standard prompt only ask when this is set.
            event.returnValue = ''
        }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [armed])
}
