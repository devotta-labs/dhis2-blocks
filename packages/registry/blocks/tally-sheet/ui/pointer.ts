import { createStore } from 'zustand/vanilla'

/** The cell under a mouse pointer and the cell holding focus; only the headings read it. */
export interface HeadingsState {
    pointed?: number
    focused?: number
}

/** The open cell that takes the grid's one tab stop: the last one focused; and the cell whose field last had focus. */
export interface TabStopState {
    tabStop?: number
    field?: number
}

export const createSheetPointer = () => ({
    headings: createStore<HeadingsState>()(() => ({})),
    tabStop: createStore<TabStopState>()(() => ({})),
})

export type SheetPointer = ReturnType<typeof createSheetPointer>

/** The cell whose headings are highlighted: the pointed one, else the focused one. */
export const activeCell = ({ pointed, focused }: HeadingsState) =>
    pointed ?? focused
