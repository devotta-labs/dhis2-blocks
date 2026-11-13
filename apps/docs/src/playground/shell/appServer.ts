import type { LabRequest } from '../working-list/table/labServer'

/** What the DHIS2 header bar asks for, beside its own `me`. */
const HEADER = new Map<string, object>([
    ['systemSettings/applicationTitle', { applicationTitle: 'Lab clinic' }],
    ['systemSettings/helpPageLink', { helpPageLink: '' }],
    ['action::menu/getModules', { modules: [] }],
    [
        'me/dashboard',
        { unreadInterpretations: 0, unreadMessageConversations: 0 },
    ],
    // No custom logo: the bar draws the DHIS2 one.
    ['staticContent/logo_banner', {}],
])

export const HEADER_RESOURCES = [...HEADER.keys()]

type ListServer = (
    request: LabRequest,
    type: 'read' | 'create' | 'update' | 'replace' | 'delete'
) => Promise<object>

/** The working list's fake DHIS2 with the header bar's requests answered in front of it. */
export const createAppServer =
    (list: ListServer): ListServer =>
    async (request, type) => {
        const header = HEADER.get(request.resource)
        if (header) return header
        // The header bar and the working list both read `me`, for different fields.
        if (
            request.resource === 'me' &&
            String(request.params?.fields).includes('authorities')
        ) {
            return {
                name: 'Lab Nurse',
                email: 'nurse@example.org',
                authorities: [],
                settings: { keyUiLocale: 'en' },
            }
        }
        return list(request, type)
    }
