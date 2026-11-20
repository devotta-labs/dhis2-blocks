const ROOT = 'org-unit-switcher'

/** Every key starts with the client's cache id, so two data engines never share results. */
export const orgUnitQueryKeys = {
    me: (clientId: number) => [ROOT, clientId, 'me'] as const,
    search: (clientId: number, userId: string, query: string) =>
        [ROOT, clientId, 'search', userId, query] as const,
    byId: (clientId: number, userId: string, ids: string[]) =>
        [ROOT, clientId, 'byId', userId, [...ids].sort()] as const,
}
