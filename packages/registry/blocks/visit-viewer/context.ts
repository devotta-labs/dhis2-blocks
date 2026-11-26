import { createContext, useContext } from 'react'
import type { Dhis2Calendar } from '@/components/dhis2-value-display'

export interface VisitViewerSettings {
    calendar: Dhis2Calendar
    locale?: string
}

const DEFAULT_SETTINGS: VisitViewerSettings = { calendar: 'gregorian' }

export const VisitViewerContext =
    createContext<VisitViewerSettings>(DEFAULT_SETTINGS)

/** The calendar and locale `VisitViewer` formats dates in: Gregorian and the browser's locale outside one. */
export const useVisitViewer = () => useContext(VisitViewerContext)

/** Whether a part sits in a list or definition its own element belongs to. */
export const InVisitFact = createContext(false)
export const InVisitServices = createContext(false)

export type LabelRegister = (id: string | undefined) => void

/** Lets a heading name the section it sits in, once it renders. */
export const SectionLabel = createContext<LabelRegister | undefined>(undefined)
