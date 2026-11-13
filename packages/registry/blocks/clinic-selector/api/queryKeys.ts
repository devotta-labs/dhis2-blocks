const ROOT = 'clinic-selector'

/** Every key starts with the client's cache id, so two data engines never share results. */
export const clinicQueryKeys = {
    me: (clientId: number) => [ROOT, clientId, 'me'] as const,
    search: (clientId: number, userId: string, query: string) =>
        [ROOT, clientId, 'search', userId, query] as const,
    byId: (clientId: number, userId: string, ids: string[]) =>
        [ROOT, clientId, 'byId', userId, [...ids].sort()] as const,
}
