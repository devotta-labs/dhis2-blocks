import i18n from '@dhis2/d2-i18n'
import React, { createContext, useContext } from 'react'

export type WorkingListTranslationValues = Record<
    string,
    string | number | boolean | undefined
>

export type WorkingListTranslate = (
    message: string,
    values?: WorkingListTranslationValues
) => string

const defaultTranslate: WorkingListTranslate = (message, values) =>
    i18n.t(message, values)

const WorkingListTextContext =
    createContext<WorkingListTranslate>(defaultTranslate)

export const WorkingListTextProvider = ({
    children,
    translate = defaultTranslate,
}: {
    children: React.ReactNode
    translate?: WorkingListTranslate
}) => (
    <WorkingListTextContext.Provider value={translate}>
        {children}
    </WorkingListTextContext.Provider>
)

export const useWorkingListText = () => useContext(WorkingListTextContext)

export const defaultWorkingListTranslate = defaultTranslate
