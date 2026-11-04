export interface PropReference {
    start: number
    end: number
    path: string[]
}

export interface CanvasSource {
    code: string
    references: PropReference[]
    props: object
}

export const propValue = (source: CanvasSource, reference: PropReference) => {
    let current: PropertyDescriptor = { value: source.props }
    for (const key of reference.path) {
        const property = Object.getOwnPropertyDescriptor(
            Object(current.value),
            key
        )
        if (!property || !Object.hasOwn(property, 'value')) return
        current = property
    }
    if (current.value instanceof Function) return '[Function]'
    return JSON.stringify(current.value, null, 2) ?? 'undefined'
}
