import {
    ObservationCard,
    ObservationLabel,
    ObservationRecorded,
    ObservationSparkline,
    ObservationsProvider,
    ObservationValue,
} from '@/components/observation-cards'
import type { LabSettings } from './labData'

interface CardSpec {
    dataElement: string
    unit?: string
}

interface Props {
    trackedEntity: string
    program: string
    cards: CardSpec[]
    settings: Pick<
        LabSettings,
        'cardsPerRow' | 'cardWidth' | 'staleAfterDays' | 'arrangement'
    >
}

/** The cards on a grid of the chosen width. */
const Cards = ({ cards, settings }: Pick<Props, 'cards' | 'settings'>) => (
    <div
        className="grid gap-4"
        style={{
            gridTemplateColumns: `repeat(${settings.cardsPerRow}, ${settings.cardWidth}px)`,
        }}
    >
        {cards.map(({ dataElement, unit }) => (
            <div key={dataElement} className="grid">
                <ObservationCard
                    dataElement={dataElement}
                    unit={unit}
                    staleAfterDays={settings.staleAfterDays || undefined}
                >
                    {settings.arrangement === 'composed' ? (
                        <>
                            <ObservationLabel />
                            <ObservationValue />
                            <ObservationSparkline points={6} />
                            <ObservationRecorded />
                        </>
                    ) : null}
                </ObservationCard>
            </div>
        ))}
    </div>
)

export const ObservationsCanvas = ({
    trackedEntity,
    program,
    cards,
    settings,
}: Props) => (
    <ObservationsProvider trackedEntity={trackedEntity} program={program}>
        <Cards cards={cards} settings={settings} />
    </ObservationsProvider>
)
