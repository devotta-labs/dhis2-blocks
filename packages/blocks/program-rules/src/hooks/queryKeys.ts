export const programRulesQueryKeys = {
    all: ['program-rules'] as const,
    metadata: (programId: string) =>
        [...programRulesQueryKeys.all, 'metadata', programId] as const,
    orgUnitGroups: (groups: ReadonlyArray<string>) =>
        [
            ...programRulesQueryKeys.all,
            'org-unit-groups',
            [...groups].sort(),
        ] as const,
    /** Without `withEvents`, the prefix of both cached forms: invalidate it after saving an event. */
    enrollment: (enrollmentId: string, withEvents?: boolean) =>
        withEvents === undefined
            ? ([
                  ...programRulesQueryKeys.all,
                  'enrollment',
                  enrollmentId,
              ] as const)
            : ([
                  ...programRulesQueryKeys.all,
                  'enrollment',
                  enrollmentId,
                  withEvents ? 'with-events' : 'without-events',
              ] as const),
}
