import { WORKING_LIST_PAGE_SIZES } from '@/components/working-list'
import { Check, Section, SelectRow } from '../../controls'
import type { LabView } from './labData'

/** The few settings worth changing by hand; the examples cover the rest. */
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
                options={WORKING_LIST_PAGE_SIZES.map(
                    (size) => [String(size), String(size)] as const
                )}
                onChange={(size) =>
                    set({
                        pageSize:
                            WORKING_LIST_PAGE_SIZES.find(
                                (each) => String(each) === size
                            ) ?? view.pageSize,
                    })
                }
            />
            <Check
                checked={view.dataQuality === 'highlighted'}
                onChange={(highlighted) =>
                    set({ dataQuality: highlighted ? 'highlighted' : 'hidden' })
                }
            >
                Highlight unreadable values
            </Check>
        </Section>
    )
}
