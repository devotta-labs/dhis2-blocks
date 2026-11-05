import i18n from '@dhis2/d2-i18n'
import { typedText } from '@/components/dhis2-value-types'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { AnnotationsState } from '../model/annotations'
import type { CellKey, GridTable } from '../model/types'
import type { CellStoreState } from '../store/store'
import { fieldAt } from './navGrid'

/**
 * Ctrl/Cmd+D: what the cell takes from the cell above it, typed as a Ready cell shows the value. `{ commit }` is the
 * text to commit as typing; `{ say }` is what to announce when nothing can be copied: the cell's reason, or that
 * nothing is above. A hidden or closed cell above holds nothing the person can see. A refused text stays a draft and
 * is announced by the grid's own store subscription.
 */
export const fillDown = (
    state: CellStoreState,
    annotations: AnnotationsState,
    closed: GridTable['closed'],
    settings: ValueSettings,
    key: CellKey,
    above: CellKey | undefined,
    reason: string | undefined
): { commit: string } | { say: string } => {
    if (reason !== undefined) {
        return { say: reason }
    }
    const value =
        above === undefined ||
        closed.has(above) ||
        annotations.cells[above]?.hiddenBy !== undefined
            ? undefined
            : state.cells[above]?.value
    return above === undefined || value === undefined
        ? { say: i18n.t('Nothing above to copy.') }
        : { commit: typedText(fieldAt(state, above), value, settings) }
}
