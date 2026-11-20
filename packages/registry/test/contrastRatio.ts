const channels = (colour: string) => {
    const numbers = colour.match(/[\d.]+/g)?.map(Number)
    if (numbers === undefined || numbers.length < 3) {
        throw new Error(`Cannot read ${colour} as a colour`)
    }
    const scale = colour.startsWith('color(') ? 1 : 255
    return numbers.slice(0, 3).map((n) => n / scale)
}

const luminance = (colour: string) => {
    const [r = 0, g = 0, b = 0] = channels(colour).map((value) =>
        value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    )
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The WCAG contrast ratio of two computed colours (`rgb()` or `color(srgb)`). */
export const contrastRatio = (first: string, second: string) => {
    const [lighter = 0, darker = 0] = [
        luminance(first),
        luminance(second),
    ].sort((a, b) => b - a)
    return (lighter + 0.05) / (darker + 0.05)
}
