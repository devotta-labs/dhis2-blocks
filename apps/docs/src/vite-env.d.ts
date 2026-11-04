/// <reference types="vite/client" />

declare module '*?canvas' {
    const source: {
        code: string
        references: { start: number; end: number; path: string[] }[]
    }
    export default source
}
