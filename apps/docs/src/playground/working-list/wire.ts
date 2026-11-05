/** The query values emulated by the table and calendar lab adapters. */
export type WireParams = Record<
    string,
    string | number | boolean | undefined | ReadonlyArray<string | number>
>
