import type { RequestLogEntry } from '../network'
import { EXAMPLES, type DensityMode, type ExampleName } from './examples'

export type Width = 'phone' | 'tablet' | 'full'

export interface LabState {
    example: ExampleName
    density: DensityMode
    width: Width
    requests: RequestLogEntry[]
}

export type LabAction =
    | { type: 'pickExample'; example: ExampleName }
    | { type: 'changeDensity'; density: DensityMode }
    | { type: 'changeWidth'; width: Width }
    | {
          type: 'logRequests'
          update: (entries: RequestLogEntry[]) => RequestLogEntry[]
      }
    | { type: 'clearRequests' }

/** The linked example (`?preset=`), or the app, with a compact shell around a comfortable canvas. */
export const initialLabState = (linkedExample?: string): LabState => ({
    example:
        EXAMPLES.find((each) => each.name === linkedExample)?.name ??
        EXAMPLES[0].name,
    density: 'mixed',
    width: 'full',
    requests: [],
})

export const labReducer = (state: LabState, action: LabAction): LabState => {
    switch (action.type) {
        // Density and width stay, so every example can be seen the same way.
        case 'pickExample':
            return { ...state, example: action.example, requests: [] }
        case 'changeDensity':
            return { ...state, density: action.density }
        case 'changeWidth':
            return { ...state, width: action.width }
        case 'logRequests':
            return { ...state, requests: action.update(state.requests) }
        case 'clearRequests':
            return { ...state, requests: [] }
    }
}
