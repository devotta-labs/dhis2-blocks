/**
 * The docs' examples name the ids of the DHIS2 Sierra Leone demo database, so a
 * reader can copy them. The playground's fake servers name their own. This puts
 * one in front of the other: requests are read with the lab's ids, answers are
 * written with the example's.
 */
export type RequestType = 'read' | 'create' | 'update' | 'replace' | 'delete'

export type IdAliases = Readonly<Record<string, string>>

const replaceAll = <Value>(value: Value, pairs: [string, string][]): Value => {
    if (pairs.length === 0) return value
    let json = JSON.stringify(value)
    for (const [from, to] of pairs) json = json.split(from).join(to)
    // SAFETY: only ids are swapped, in a value that was JSON already.
    return JSON.parse(json) as Value
}

/** `aliases` maps the example's id to the fake server's. */
export const aliasIds = <Request extends object>(
    respond: (request: Request, type: RequestType) => object | Promise<object>,
    aliases: IdAliases
) => {
    const toLab = Object.entries(aliases)
    const toExample = toLab.map(([example, lab]): [string, string] => [
        lab,
        example,
    ])
    return async (request: Request, type: RequestType): Promise<object> =>
        replaceAll(await respond(replaceAll(request, toLab), type), toExample)
}
