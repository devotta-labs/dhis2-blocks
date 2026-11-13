export { ageFromBirth, birthFromAge, futureBirth } from './age'
export type { Age } from './age'
export { addDaysIso, addMonthsIso, parseDateFormat, todayIso } from './dates'
export { OPTION_LIMIT, optionIndex, searchOptions } from './optionSearch'
export type { OptionIndex } from './optionSearch'
export type {
    CellKind,
    DateFormat,
    Field,
    InputMode,
    Option,
    TypedValue,
    ValueProblem,
    ValueSettings,
} from './types'
export {
    cellKind,
    checkStored,
    coordinateNumber,
    inputModeFor,
    textDirectionFor,
    parseCoordinate,
    parseTyped,
    typedText,
} from './valueTypes'
