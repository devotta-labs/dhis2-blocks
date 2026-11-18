import { Check, Section, SelectRow } from '../controls'
import type { LabView } from './labData'

const PAGE_SIZES: readonly LabView['pageSize'][] = [10, 15, 25, 50]

const SWITCHES = [
    ['filters', 'Filters'],
    ['columnSettings', 'Column settings'],
    ['density', 'Density'],
    ['selection', 'Selection'],
    ['pagination', 'Pagination'],
    ['clickable', 'Clickable rows'],
] as const

/** The parts of the list to show, and its first page size. */
export const OptionsControls = ({
    view,
    onChange,
}: {
    view: LabView
    onChange: (view: LabView) => void
}) => {
    const set = (changes: Partial<LabView>) => onChange({ ...view, ...changes })
    return (
        <Section title="Options">
            <SelectRow
                label="Rows per page"
                value={String(view.pageSize)}
                options={PAGE_SIZES.map(
                    (size) => [String(size), String(size)] as const
                )}
                onChange={(size) =>
                    set({
                        pageSize:
                            PAGE_SIZES.find((each) => String(each) === size) ??
                            view.pageSize,
                    })
                }
            />
            {SWITCHES.map(([key, label]) => (
                <Check
                    key={key}
                    checked={view[key]}
                    onChange={(checked) => set({ [key]: checked })}
                >
                    {label}
                </Check>
            ))}
        </Section>
    )
}
