import i18n from '@dhis2/d2-i18n'
import { cellAt, cellKey } from '@/components/spreadsheet'
import type { CellKey, CellMap } from '@/components/spreadsheet'
import type { TrackerRow } from '../model/types'
import type { SlotDef } from '../register/compileLayout'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'

/** "1st", "2nd", "3rd", "4th": the number as the language orders it. */
const ordinal = (n: number) => {
    let rule: Intl.LDMLPluralRule = 'other'
    try {
        // DHIS2 writes locales as `en_US`; Intl expects `en-US`.
        rule = new Intl.PluralRules(i18n.language.replace('_', '-'), {
            type: 'ordinal',
        }).select(n)
    } catch {
        // A locale Intl cannot read keeps the general form.
    }
    switch (rule) {
        case 'one':
            return i18n.t('{{number}}st', { number: n })
        case 'two':
            return i18n.t('{{number}}nd', { number: n })
        case 'few':
            return i18n.t('{{number}}rd', { number: n })
        default:
            return i18n.t('{{number}}th', { number: n })
    }
}

/**
 * Why each occurrence slot's date is out of order, by date cell: a visit dated before the nearest dated visit before
 * it, or after the nearest dated one after it, would fill another visit's slot once loaded again. Only slots with a
 * date column have a cell to say it on; dates are `YYYY-MM-DD`, so text order is date order.
 */
export const slotOrderWarnings = (
    rows: ReadonlyArray<TrackerRow>,
    cells: CellMap,
    slots: ReadonlyArray<SlotDef>
): ReadonlyMap<CellKey, string> => {
    const byStage = new Map<string, SlotDef[]>()
    for (const slot of slots) {
        if (slot.kind === 'occurrence' && slot.stageId !== undefined) {
            byStage.set(slot.stageId, [
                ...(byStage.get(slot.stageId) ?? []),
                slot,
            ])
        }
    }
    const visits = [...byStage.values()].map((stage) =>
        stage.sort((a, b) => (a.occurrence ?? 0) - (b.occurrence ?? 0))
    )
    const warnings = new Map<CellKey, string>()
    for (const row of rows) {
        for (const stage of visits) {
            const dated = stage.flatMap((slot) => {
                const record = row.slots?.[slot.name]
                const key =
                    record === undefined
                        ? undefined
                        : cellKey(record, EVENT_DATE_COLUMN)
                const date =
                    key === undefined ? undefined : cellAt(cells, key)?.value
                return key === undefined || !date ? [] : [{ slot, key, date }]
            })
            dated.forEach(({ slot, key, date }, i) => {
                const [before, after] = [dated[i - 1], dated[i + 1]]
                if (!slot.hasDateColumn) {
                    return
                }
                if (before !== undefined && date < before.date) {
                    warnings.set(
                        key,
                        i18n.t('Earlier than the {{ordinal}} visit', {
                            ordinal: ordinal(before.slot.occurrence ?? 0),
                        })
                    )
                } else if (after !== undefined && date > after.date) {
                    warnings.set(
                        key,
                        i18n.t('Later than the {{ordinal}} visit', {
                            ordinal: ordinal(after.slot.occurrence ?? 0),
                        })
                    )
                }
            })
        }
    }
    return warnings
}
