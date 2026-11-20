export const exhaustLocalStorage = () => {
    const key = 'quota-filler'
    const contents = 'x'.repeat(6 * 1024 * 1024)
    let fits = 0
    let tooLarge = contents.length
    while (tooLarge - fits > 1) {
        const size = Math.floor((tooLarge + fits) / 2)
        try {
            localStorage.setItem(key, contents.slice(0, size))
            fits = size
        } catch (error) {
            if (
                !(error instanceof DOMException) ||
                error.name !== 'QuotaExceededError'
            ) {
                throw error
            }
            tooLarge = size
        }
    }
}
