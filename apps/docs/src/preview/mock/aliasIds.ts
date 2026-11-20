/**
 * The examples show copy-pasteable DHIS2 uids from the Sierra Leone demo
 * database, while the playground's fake servers answer for their own ids.
 * `aliasIds` puts the two side by side: requests from the example are
 * translated into the fake server's ids, and the answers back into the
 * example's, so the example's code stays what a reader would copy.
 */

/** Example uid to the fake server's id for the same thing. */
export type IdAliases = Readonly<Record<string, string>>

type Respond<Request, Result> = (
    request: Request,
    type: 'read' | 'create' | 'update' | 'replace' | 'delete'
) => Result | Promise<Result>

/** Ids this short could be part of a word, so they are only replaced as a whole value. */
const SUBSTRING_MIN = 8

/** Swaps ids in a JSON text, the way a find-and-replace over the document would. */
const translator = (aliases: Record<string, string>) => {
    const entries = Object.entries(aliases)
    return (json: string) =>
        entries.reduce(
            (result, [from, to]) =>
                from.length >= SUBSTRING_MIN
                    ? result.replaceAll(from, to)
                    : result.replaceAll(`"${from}"`, `"${to}"`),
            json
        )
}

export const aliasIds = <Request extends object>(
    respond: Respond<Request, object>,
    aliases: IdAliases
): Respond<Request, object> => {
    const inbound = translator({ ...aliases })
    // Several example ids may share one fake id; the first listed names it.
    const back: Record<string, string> = {}
    for (const [from, to] of Object.entries(aliases)) back[to] ??= from
    const outbound = translator(back)
    return async (request, type) => {
        // Only ids change, so the request and the answer keep their shape.
        const translated: Request = JSON.parse(inbound(JSON.stringify(request)))
        const result = await respond(translated, type)
        return JSON.parse(outbound(JSON.stringify(result)))
    }
}
