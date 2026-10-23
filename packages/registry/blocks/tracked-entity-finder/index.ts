/** Entry point: later tasks add the results parts and hooks. */
export {
    createTrackedEntityFinderClient,
    type DataEngineLike,
    type TrackedEntityFinderClient,
} from './api/client'
export type { FinderPerson } from './api/search'
export { FinderField, type FinderFieldProps } from './form/FinderField'
export { FinderForm, type FinderFormProps } from './form/FinderForm'
export { FinderHint, type FinderHintProps } from './form/FinderHint'
export {
    FinderRangeField,
    type FinderRangeFieldProps,
} from './form/FinderRangeField'
export { FinderSubmit, type FinderSubmitProps } from './form/FinderSubmit'
export {
    useFinderField,
    useFinderProgram,
    useFinderRangeField,
    useFinderSearch,
} from './hooks'
export {
    FinderProvider,
    type FinderProviderProps,
} from './provider/FinderProvider'
