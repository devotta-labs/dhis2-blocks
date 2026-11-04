import type { SearchFilter, ValidatedSearch } from './types'

/**
 * The only way to make a `ValidatedSearch`. Import it only inside `rules/`
 * (a test guards this), after the filters were checked against the program.
 */
export const seal = (filters: readonly SearchFilter[]): ValidatedSearch => {
    const frozen = Object.freeze({
        filters: Object.freeze(
            filters.map(({ attribute, conditions }) =>
                Object.freeze({
                    attribute,
                    conditions: Object.freeze(
                        conditions.map(({ op, value }) =>
                            Object.freeze({ op, value })
                        )
                    ),
                })
            )
        ),
    })
    // SAFETY: the brand is type-only; this is the one place that asserts it,
    // and only rule modules call it, with filters checked against the program.
    return frozen as ValidatedSearch
}
