import {
    ObservationCard,
    ObservationsProvider,
} from '@/components/observation-cards'

const PERSON = 'Y8aEiTpHSSQ'
const PROGRAM = 'WSGAb5XwJ3Y'
const HAEMOGLOBIN = 'vANAXwtLwcT'
const SMOKING = 'sWoqcoByYmD'
const EXTREME_PALLOR = 'EyfTU3ibMmJ'

/**
 * One person's haemoglobin trend, smoking status and extreme pallor. Each card
 * is one data element; the provider loads the person's events once for all.
 *
 * WHO RMNCH Tracker in the Sierra Leone demo database: person `Y8aEiTpHSSQ`
 * in program `WSGAb5XwJ3Y`, with several haemoglobin readings. Replace with
 * your program's uids. List a program's data elements with:
 * GET /api/programs/<program>?fields=programStages[programStageDataElements[dataElement[id,displayName,valueType]]]
 */
export default function PersonVitals() {
    return (
        <ObservationsProvider trackedEntity={PERSON} program={PROGRAM}>
            <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                <ObservationCard dataElement={HAEMOGLOBIN} unit="g/dL" />
                <ObservationCard dataElement={SMOKING} staleAfterDays={180} />
                <ObservationCard dataElement={EXTREME_PALLOR} />
            </div>
        </ObservationsProvider>
    )
}
