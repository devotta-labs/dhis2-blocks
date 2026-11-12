import { useMemo } from 'react'
import { useProgramMetadata, useSystemInfo } from '../api/queries'
import { buildProgramModel } from '../rules/programModel'
import { useFinderContext } from './context'

/**
 * The program's search rules and the server's calendar: what every part
 * needs before it can search or show a date. `isPending` until both have
 * loaded; `isError` once either failed.
 */
export const useFinderModel = () => {
    const { program } = useFinderContext()
    const metadata = useProgramMetadata(program)
    const systemInfo = useSystemInfo()
    // Built before system info arrives, so fields show their labels; until
    // then MULTI_TEXT counts as searchable, so an older server's error shows
    // only once it is known. Nothing searches before system info anyway.
    const multiTextSearch = systemInfo.data?.multiTextSearch ?? true
    const model = useMemo(
        () =>
            metadata.data
                ? buildProgramModel(metadata.data, { multiTextSearch })
                : undefined,
        [metadata.data, multiTextSearch]
    )
    const isError = metadata.isError || systemInfo.isError
    return {
        model,
        info: systemInfo.data,
        isError,
        isPending: !isError && (metadata.isPending || systemInfo.isPending),
    }
}
