export interface CanvasSource {
    name: string
    code: string
    props: object
}

export const sourceFile = (
    source: CanvasSource,
    file: 'composition' | 'props'
) => {
    if (file === 'props') {
        return {
            language: 'json',
            code: JSON.stringify(source.props, null, 2),
        }
    }
    return { language: 'tsx', code: source.code }
}
