import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import { createRuntimeWorkingListClient } from '../api/runtimeAdapter'

export const useRuntimeWorkingListClient = () => {
    const engine = useDataEngine()
    return useMemo(() => createRuntimeWorkingListClient(engine), [engine])
}
