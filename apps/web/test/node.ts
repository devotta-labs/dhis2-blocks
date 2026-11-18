// `@dhis2/app-runtime` reads a debug flag from `localStorage` as it loads, and
// Node has none: the patient list's index brings the runtime in, so a node
// test that imports it would fail to load without this empty one.
Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: () => null },
})

// @dhis2/ui-constants builds its prop types with `instanceOf(Element)` as it
// loads; Node has no DOM.
Object.defineProperty(globalThis, 'Element', { value: class Element {} })
