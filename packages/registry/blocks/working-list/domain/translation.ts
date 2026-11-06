import i18n from '@dhis2/d2-i18n'

export type WorkingListTranslate = (
    message: string,
    values?: Record<string, string | number | boolean | undefined>
) => string

export const defaultWorkingListTranslate: WorkingListTranslate = (
    message,
    values
) => i18n.t(message, values)
