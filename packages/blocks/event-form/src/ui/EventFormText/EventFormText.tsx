import i18n from '@dhis2/d2-i18n'
import React, { createContext, useContext } from 'react'

type EventFormTranslationValues = Record<
    string,
    string | number | boolean | undefined
>

export type EventFormTranslate = (
    message: string,
    values?: EventFormTranslationValues
) => string

const defaultTranslate: EventFormTranslate = (message, values) =>
    i18n.t(message, values)

const EventFormTextContext = createContext<EventFormTranslate>(defaultTranslate)

export const EventFormTextProvider = ({
    children,
    translate = defaultTranslate,
}: {
    children: React.ReactNode
    translate?: EventFormTranslate
}) => (
    <EventFormTextContext.Provider value={translate}>
        {children}
    </EventFormTextContext.Provider>
)

export const useEventFormText = () => useContext(EventFormTextContext)
