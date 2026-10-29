import React, { createContext, useContext, type ReactNode } from 'react'
import type {
    RelationshipViewerActions,
    RelationshipViewerMeta,
    RelationshipViewerState,
} from './contracts'

const StateContext = createContext<RelationshipViewerState | null>(null)
const ActionsContext = createContext<RelationshipViewerActions | null>(null)
const MetaContext = createContext<RelationshipViewerMeta | null>(null)

export function RelationshipViewerProvider({
    state,
    actions,
    meta,
    children,
}: {
    state: RelationshipViewerState
    actions: RelationshipViewerActions
    meta: RelationshipViewerMeta
    children: ReactNode
}) {
    return (
        <StateContext.Provider value={state}>
            <ActionsContext.Provider value={actions}>
                <MetaContext.Provider value={meta}>
                    {children}
                </MetaContext.Provider>
            </ActionsContext.Provider>
        </StateContext.Provider>
    )
}

const useRequired = <T,>(context: React.Context<T | null>): T => {
    const value = useContext(context)
    if (!value) {
        throw new Error(
            'Relationship Viewer hooks must be used within RelationshipViewer or RelationshipViewerProvider.'
        )
    }
    return value
}

export const useRelationshipViewerState = () => useRequired(StateContext)
export const useRelationshipViewerActions = () => useRequired(ActionsContext)
export const useRelationshipViewerMeta = () => useRequired(MetaContext)
