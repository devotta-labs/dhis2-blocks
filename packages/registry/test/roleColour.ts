/** The colour `--dhis2-<role>` computes to in the current colour mode. */
export const roleColour = (role: string) => {
    const variable = `--dhis2-${role}`
    const declared = getComputedStyle(document.documentElement)
        .getPropertyValue(variable)
        .trim()
    if (declared === '') throw new Error(`${variable} is not defined`)
    const probe = document.createElement('span')
    probe.style.color = `var(${variable})`
    document.body.append(probe)
    const { color } = getComputedStyle(probe)
    probe.remove()
    return color
}
