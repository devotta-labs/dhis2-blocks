import { CustomDataProvider, useCurrentUserInfo } from '@dhis2/app-runtime'
import { useMemo, type ReactNode } from 'react'
import { RULES_SERVER } from './rulesForm'

/**
 * The rules demo's own server: its program rules and calendar, none of them stored on DHIS2. The user is the one
 * signed in: the grid checks who is signed in against the real server, and locks for anyone else.
 */
export const RulesData = ({ children }: { children: ReactNode }) => {
    const id = useCurrentUserInfo()?.id
    const data = useMemo(
        () =>
            id === undefined
                ? undefined
                : {
                      ...RULES_SERVER,
                      me: { id, userRoles: [], userGroups: [] },
                  },
        [id]
    )
    if (data === undefined) {
        return (
            <p role="status" className="text-sm text-dhis2-grey-700">
                Loading…
            </p>
        )
    }
    return <CustomDataProvider data={data}>{children}</CustomDataProvider>
}
