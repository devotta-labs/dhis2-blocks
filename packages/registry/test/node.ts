// `@dhis2/app-runtime` reads a debug flag from `localStorage` as it loads, and Node has none: a block's index that
// brings the runtime in (the spreadsheet's does) would fail to load in a node test without this empty one.
Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: () => null },
})

// @dhis2/ui-constants builds its prop types with `instanceOf(Element)` as it loads; Node has no DOM.
Object.defineProperty(globalThis, 'Element', { value: class Element {} })
