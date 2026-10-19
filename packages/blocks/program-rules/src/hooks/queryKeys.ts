export const programRulesQueryKeys = {
    all: ['program-rules'] as const,
    engine: () => [...programRulesQueryKeys.all, 'engine'] as const,
    metadata: (programId: string) =>
        [...programRulesQueryKeys.all, 'metadata', programId] as const,
    orgUnitGroups: (groups: ReadonlyArray<string>) =>
        [
            ...programRulesQueryKeys.all,
            'org-unit-groups',
            [...groups].sort(),
        ] as const,
    enrollment: (enrollmentId: string, withEvents: boolean) =>
        [
            ...programRulesQueryKeys.all,
            'enrollment',
            enrollmentId,
            withEvents ? 'with-events' : 'without-events',
        ] as const,
}
