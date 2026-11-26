import { onTestFinished } from 'vitest'
import { liveRegion } from '../../../test/liveRegion'

/** Everything the polite live region says from now until the test ends. */
export const listen = () => {
    const region = liveRegion('polite')
    const heard: string[] = []
    const observer = new MutationObserver(() => {
        const text = region.textContent ?? ''
        if (text !== '') heard.push(text)
    })
    observer.observe(region, {
        childList: true,
        characterData: true,
        subtree: true,
    })
    onTestFinished(() => observer.disconnect())
    return heard
}

/** A row's heading, by the row's label. */
export const rowHeaderOf = (row: string) => {
    const header = [
        ...document.querySelectorAll<HTMLElement>('th[scope="row"]'),
    ].find((th) => th.querySelector('[dir="auto"]')?.textContent === row)
    if (header === undefined) throw new Error(`No row ${row}`)
    return header
}

/** The grid cell of a row, by its label, in a column, counted from the start. */
export const cellIn = (row: string, column: number) => {
    const cell = rowHeaderOf(row).closest('tr')?.querySelectorAll('td')[column]
    if (cell === undefined) throw new Error(`No cell ${row} ${column}`)
    return cell
}

export const buttonIn = (row: string, column: number) => {
    const button = cellIn(row, column).querySelector('button')
    if (button === null) throw new Error(`No button in ${row} ${column}`)
    return button
}

export const inputIn = (row: string, column: number) => {
    const input = cellIn(row, column).querySelector('input')
    if (input === null) throw new Error(`No input in ${row} ${column}`)
    return input
}
