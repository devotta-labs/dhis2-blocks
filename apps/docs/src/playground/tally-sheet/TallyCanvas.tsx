import {
    TallySheet,
    type TallyEntry,
    type TallyLayout,
} from '@/components/tally-sheet'

interface Props {
    layout: TallyLayout
    label: string
    /** The session's log as the host holds it. */
    entries: readonly TallyEntry[]
    /** This device, on every entry it makes. */
    by: string
    rtl: boolean
    onAppend: (entries: readonly TallyEntry[]) => void
}

/** A tally sheet over a log the host keeps. */
export const TallyCanvas = ({
    layout,
    label,
    entries,
    by,
    rtl,
    onAppend,
}: Props) => (
    <div
        dir={rtl ? 'rtl' : 'ltr'}
        className="w-full min-w-0 rounded-lg bg-dhis2-background p-4 md:p-6"
    >
        <TallySheet
            layout={layout}
            label={label}
            entries={entries}
            by={by}
            onAppend={onAppend}
        />
    </div>
)
