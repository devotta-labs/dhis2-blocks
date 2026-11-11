import { readFileSync } from 'node:fs'
import { z } from 'zod'

/** A recorded DHIS2 response from `api/__fixtures__`. Node tests only. */
export const fixture = (name: string) =>
    z
        .json()
        .parse(
            JSON.parse(
                readFileSync(
                    new URL(`../api/__fixtures__/${name}`, import.meta.url),
                    'utf8'
                )
            )
        )
