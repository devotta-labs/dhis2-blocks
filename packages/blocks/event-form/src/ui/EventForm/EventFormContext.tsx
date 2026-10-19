import { createContext, useContext, useSyncExternalStore } from 'react'
import type { SystemCalendar } from '../../api/schemas'
import type { FieldModel, FormModel } from '../../model/buildFormModel'

/**
 * Where a field reads its model from. A field subscribes to its own entry, so a commit that
 * changes one field's model re-renders that field and no other: `buildFormModel` returns the
 * same object for a field whose content did not change.
 */
interface FormModelSource {
    getField(id: string): FieldModel | undefined
    subscribe(listener: () => void): () => void
}

export interface MutableFormModelSource extends FormModelSource {
    setModel(model: FormModel): void
}

export const createFormModelSource = (
    initial: FormModel
): MutableFormModelSource => {
    let model = initial
    const listeners = new Set<() => void>()
    return {
        getField: (id) => model.fields.get(id),
        subscribe: (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        setModel: (next) => {
            model = next
            listeners.forEach((listener) => listener())
        },
    }
}

export interface EventFormFieldContextValue {
    source: FormModelSource
    /** Stores a field's value in tracker API format; `undefined` clears it. */
    commit(id: string, value: string | undefined): void
    /** The instance's calendar, for date fields. */
    calendar: SystemCalendar
    /** The form is read-only (a skipped or locked event): every field is disabled. */
    readOnly: boolean
    /** Organisation unit ids the organisation unit picker starts its tree from. */
    orgUnitRoots: readonly string[]
}

export const EventFormFieldContext =
    createContext<EventFormFieldContextValue | null>(null)

export const useEventFormFieldContext = (): EventFormFieldContextValue => {
    const context = useContext(EventFormFieldContext)
    if (context === null) {
        throw new Error('EventFormField must be rendered inside an EventForm')
    }
    return context
}

export const useFieldModel = (id: string): FieldModel | undefined => {
    const { source } = useEventFormFieldContext()
    return useSyncExternalStore(
        source.subscribe,
        () => source.getField(id),
        () => source.getField(id)
    )
}
