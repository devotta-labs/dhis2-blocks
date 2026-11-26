import { useEffect, useRef } from 'react'
import { announce } from '@/components/dhis2/ui/announcer'
import { Badge } from '@/components/dhis2/ui/badge'
import {
    TallySheet,
    type TallyLayout,
    type TallyRow,
} from '@/components/tally-sheet'

const MORBIDITY: TallyLayout = {
    categories: [
        {
            id: 'age',
            label: 'Age',
            options: [
                { id: 'under5', label: 'Under 5' },
                { id: 'over5', label: '5 and over' },
            ],
        },
        {
            id: 'sex',
            label: 'Sex',
            options: [
                { id: 'female', label: 'Female' },
                { id: 'male', label: 'Male' },
            ],
        },
    ],
    rows: [
        { id: 'malaria', label: 'Malaria (suspected)' },
        { id: 'pneumonia', label: 'Pneumonia' },
        { id: 'wateryDiarrhoea', label: 'Watery diarrhoea' },
        { id: 'bloodyDiarrhoea', label: 'Bloody diarrhoea' },
        { id: 'measles', label: 'Measles' },
    ],
}

const THRESHOLDS = new Map([
    ['measles', 1],
    ['bloodyDiarrhoea', 5],
])

const AlertBadge = ({ row, total }: { row: TallyRow; total: number }) => {
    const threshold = THRESHOLDS.get(row.id)
    const before = useRef(total)
    useEffect(() => {
        const was = before.current
        before.current = total
        if (threshold !== undefined && was < threshold && total >= threshold) {
            announce(`${row.label}: alert threshold reached`)
        }
    }, [row.label, threshold, total])
    if (threshold === undefined || total < threshold) return null
    return (
        <Badge className="bg-dhis2-destructive-fill text-dhis2-destructive-strong">
            Alert
        </Badge>
    )
}

const AlertThreshold = () => (
    <TallySheet
        layout={MORBIDITY}
        label="OPD morbidity tally"
        RowBadge={AlertBadge}
    />
)

/**
 * An example: an OPD morbidity sheet that marks a row Alert, and says so, once its total reaches the row's threshold.
 *
 * The thresholds are placeholders; take them from your programme's alert rules.
 */
export default AlertThreshold
