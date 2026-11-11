import type { CellKey } from '@/components/spreadsheet'
import type { TrackerMessage } from '../logic/effects'
import { effectsWriter, sameMessages } from '../logic/effects'
import { slotOrderWarnings } from '../logic/slotOrder'
import type { SlotDef } from '../register/compileLayout'
import type { OpenForm } from './openForm'

/**
 * Keeps each out-of-order visit date's warning on its cell as the dates change; it never blocks. Other effects (the
 * rules', a saved status's) rewrite a cell's messages, so the warning is put back after them. Returns the unsubscribe;
 * nothing is watched without occurrence slots.
 */
export const watchSlotOrder = (
    { store, effects, tables }: Pick<OpenForm, 'store' | 'effects' | 'tables'>,
    slots: ReadonlyArray<SlotDef>
) => {
    if (!slots.some(({ kind }) => kind === 'occurrence')) {
        return () => {}
    }
    // What this wrote last, by cell: only these messages are its own to take back.
    let written: ReadonlyMap<CellKey, string> = new Map()
    const update = () => {
        const wanted = slotOrderWarnings(
            tables.getState().tables.flatMap(({ rows }) => rows),
            store.getState().cells,
            slots
        )
        const state = effects.getState().cells
        const writer = effectsWriter(effects.getState())
        for (const key of new Set([...written.keys(), ...wanted.keys()])) {
            const now = state[key] ?? { required: false, messages: [] }
            const own = [written.get(key), wanted.get(key)]
            const text = wanted.get(key)
            const messages: TrackerMessage[] = [
                ...now.messages.filter(
                    (message) =>
                        message.tone !== 'warning' ||
                        message.source !== 'valueType' ||
                        !own.includes(message.text)
                ),
                ...(text === undefined
                    ? []
                    : [
                          {
                              tone: 'warning' as const,
                              text,
                              source: 'valueType' as const,
                          },
                      ]),
            ]
            if (sameMessages(messages, now.messages)) {
                continue
            }
            writer.setCell(key, { ...now, messages })
        }
        written = wanted
        const { cells, written: writes } = writer.state()
        if (cells !== state) {
            effects.setState({ cells, written: writes })
        }
    }
    update()
    const unsubscribes = [
        store.subscribe(update),
        effects.subscribe(update),
        tables.subscribe(update),
    ]
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
}
