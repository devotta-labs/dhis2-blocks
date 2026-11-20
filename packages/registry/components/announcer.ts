/** Polite waits for the person to pause; assertive interrupts, for errors. */
export type Politeness = 'polite' | 'assertive'

const CLEARED_FOR_MS = 100
const APART_MS = 150

interface Region {
    element: HTMLElement
    waiting: string | undefined
    saying: boolean
}

const regions = new Map<Politeness, Region>()

const createRegion = (politeness: Politeness) => {
    const element = document.createElement('div')
    element.setAttribute('role', politeness === 'polite' ? 'status' : 'alert')
    element.setAttribute('aria-live', politeness)
    element.setAttribute('aria-atomic', 'true')
    element.className = 'sr-only'
    document.body.append(element)
    return { element, waiting: undefined, saying: false }
}

const regionFor = (politeness: Politeness) => {
    if (regions.size === 0) {
        regions.set('polite', createRegion('polite'))
        regions.set('assertive', createRegion('assertive'))
    }
    const region = regions.get(politeness)
    if (region === undefined) {
        throw new Error(`No ${politeness} live region.`)
    }
    return region
}

const sayNext = (region: Region) => {
    const text = region.waiting
    region.waiting = undefined
    region.saying = text !== undefined
    if (text === undefined) {
        return
    }
    region.element.textContent = ''
    setTimeout(() => {
        region.element.textContent = text
        setTimeout(() => sayNext(region), APART_MS - CLEARED_FOR_MS)
    }, CLEARED_FOR_MS)
}

/**
 * Says `text` to screen reader users, in one of two live regions that stay on the page. Each region says its texts in
 * turn, and a newer text replaces one still waiting: it is the newer news. Use `'assertive'` for errors, so a status
 * message can't replace them.
 */
export function announce(text: string, politeness: Politeness = 'polite') {
    const region = regionFor(politeness)
    region.waiting = text
    if (!region.saying) {
        sayNext(region)
    }
}
