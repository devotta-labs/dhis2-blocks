import React, { createContext, useContext } from 'react'

import {
    defaultWorkingListTranslate,
    type WorkingListTranslate,
} from '../../domain/translation'

export type { WorkingListTranslate } from '../../domain/translation'

const WorkingListTextContext = createContext<WorkingListTranslate>(
    defaultWorkingListTranslate
)

export const WorkingListTextProvider = ({
    children,
    translate = defaultWorkingListTranslate,
}: {
    children: React.ReactNode
    translate?: WorkingListTranslate
}) => (
    <WorkingListTextContext.Provider value={translate}>
        {children}
    </WorkingListTextContext.Provider>
)

export const useWorkingListText = () => useContext(WorkingListTextContext)
