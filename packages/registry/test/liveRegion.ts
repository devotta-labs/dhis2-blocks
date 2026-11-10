import { announce } from '../components/announcer'
import type { Politeness } from '../components/announcer'

/** The shared live region, created first if nothing on the page has announced yet. */
export const liveRegion = (politeness: Politeness = 'polite'): HTMLElement => {
    const selector = `[aria-live="${politeness}"]`
    if (document.querySelector(selector) === null) {
        announce('', politeness)
    }
    const region = document.querySelector<HTMLElement>(selector)
    if (region === null) {
        throw new Error(`No ${politeness} live region.`)
    }
    return region
}
