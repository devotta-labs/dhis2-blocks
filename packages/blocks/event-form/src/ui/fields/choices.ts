import type { AnswerChoice } from '../../model/valueTypes'
import type { EventFormTranslate } from '../EventFormText'

/** "Yes" and "No" of a boolean are untranslated keys; every other label is metadata text. */
export const choiceLabel = (
    choice: AnswerChoice,
    translate: EventFormTranslate
): string =>
    (choice.value === 'true' && choice.label === 'Yes') ||
    (choice.value === 'false' && choice.label === 'No')
        ? translate(choice.label)
        : choice.label
