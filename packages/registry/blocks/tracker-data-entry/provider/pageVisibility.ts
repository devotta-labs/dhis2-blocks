export const respondToVisibility = (
    state: DocumentVisibilityState,
    flush: () => void,
    resume: () => void
) => {
    if (state === 'hidden') {
        flush()
    } else {
        resume()
    }
}
