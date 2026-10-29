import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import type { DataEngine } from '../../sources/types'
import type { PopupEditorProps } from '../popupEditors'
import { SearchEditor } from './SearchEditor'

const lookupSchema = z.object({
    users: z.object({
        users: z.array(
            z.object({ username: z.string(), displayName: z.string() })
        ),
    }),
})

/** The users matching the query by name or username; the lookup sends the first few, without a total. */
const searchUsers = async (
    engine: DataEngine,
    query: string,
    signal: AbortSignal
) => {
    const { users } = lookupSchema.parse(
        await engine.query(
            { users: { resource: 'userLookup', params: { query } } },
            { signal }
        )
    )
    return {
        total: users.users.length,
        results: users.users.map(({ username, displayName }) => ({
            value: username,
            name: displayName,
            detail: username,
        })),
    }
}

/** A username, searched through the user lookup; each result shows the user's name and username. A pick saves the username, which the cell shows. */
export const UsernameEditor = (props: PopupEditorProps) => (
    <SearchEditor
        {...props}
        shown={props.value ?? ''}
        label={i18n.t('Search users')}
        none={i18n.t('No users found')}
        search={searchUsers}
    />
)
