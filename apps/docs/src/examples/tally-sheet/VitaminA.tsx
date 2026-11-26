import { TallySheet, type TallyLayout } from '@/components/tally-sheet'

const VITAMIN_A: TallyLayout = {
    categories: [
        {
            id: 'status',
            label: 'Status',
            options: [
                { id: 'refugee', label: 'Refugee' },
                { id: 'national', label: 'National' },
            ],
        },
    ],
    rows: [
        { id: 'postNatal', label: 'Post-natal' },
        { id: 'dose1', label: 'Dose 1' },
        { id: 'dose2', label: 'Dose 2' },
        { id: 'dose3', label: 'Dose 3' },
    ],
}

const VitaminA = () => <TallySheet layout={VITAMIN_A} label="Vitamin A doses" />

/**
 * An example: vitamin A doses by refugee or national, on a sheet that keeps its own log.
 *
 * Pass `onAppend` to save each new entry, and `defaultEntries` to open on a saved log.
 */
export default VitaminA
