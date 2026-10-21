import { Alert, AlertDescription } from '@/registry/dhis2/ui/alert'
import { Button } from '@/registry/dhis2/ui/button'
import { useDataEngine } from '@dhis2/app-runtime'
import {
    LatestValueCard,
    TrendCard,
    useTrackedEntityObservations,
} from '@dhis2-blocks/observation-cards'
import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { EXAMPLE_CARDS } from './exampleObservations'
import { findExamplePatients, type ExamplePatient } from './findExamplePatients'
import { OBSERVATION_PRESETS, type ObservationPreset } from './presets'

const CARD_GRID = 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]'

const findPreset = (id: string | null): ObservationPreset =>
    OBSERVATION_PRESETS.find((preset) => preset.id === id) ??
    OBSERVATION_PRESETS[0]

type View = 'live' | 'examples'

const buildSearch = (
    presetId: string,
    trackedEntityId: string,
    view: View = 'live'
) => {
    const params = new URLSearchParams({ preset: presetId })
    if (trackedEntityId !== '') {
        params.set('te', trackedEntityId)
    }
    if (view === 'examples') {
        params.set('view', view)
    }
    return `?${params.toString()}`
}

const LINK_CLASS =
    'font-medium text-dhis2-primary underline-offset-2 hover:underline'

const ExamplesGallery = () => (
    <section
        aria-labelledby="observation-cards-examples"
        className="grid gap-4"
    >
        <div>
            <h2
                id="observation-cards-examples"
                className="mt-0 mb-1 text-base font-medium"
            >
                {i18n.t('All demo examples')}
            </h2>
            <p className="m-0 max-w-2xl text-sm leading-6 text-[#4a5768]">
                {i18n.t(
                    'Idealised metadata shown through the same cards, to cover every state. Real instances rarely define legend sets and option colours this completely.'
                )}
            </p>
        </div>
        <div className={CARD_GRID}>
            {EXAMPLE_CARDS.map((example) => (
                <figure
                    key={example.caption}
                    className="m-0 grid content-start gap-1"
                >
                    <figcaption className="text-xs text-[#6c7787]">
                        {example.caption}
                    </figcaption>
                    <div dir={example.dir} lang={example.lang}>
                        {example.kind === 'trend' ? (
                            <TrendCard
                                observation={example.observation}
                                unit={example.unit}
                                label={example.label}
                            />
                        ) : (
                            <LatestValueCard
                                observation={example.observation}
                                unit={example.unit}
                                label={example.label}
                                staleAfterDays={example.staleAfterDays}
                            />
                        )}
                    </div>
                </figure>
            ))}
        </div>
    </section>
)

const PresetObservations = ({
    preset,
    trackedEntityId,
}: {
    preset: ObservationPreset
    trackedEntityId: string
}) => {
    const observations = useTrackedEntityObservations({
        trackedEntityId,
        programId: preset.programId,
        dataElementIds: [...preset.trend, ...preset.latest],
    })

    const ids = [...preset.trend, ...preset.latest]
    const results = ids.map((id) => observations.get(id))
    const recorded = results.flatMap((result) =>
        result.status === 'success' && result.series.points.length > 0
            ? [result.series]
            : []
    )
    const readings = recorded.reduce(
        (total, series) => total + series.points.length,
        0
    )

    return (
        <>
            <header
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#d5dde5] pb-3"
                data-testid="patient-header"
            >
                <p className="m-0 text-lg font-medium text-[#212934]">
                    {i18n.t('Tracked entity {{id}}', {
                        id: trackedEntityId,
                        interpolation: { escapeValue: false },
                    })}
                </p>
                {observations.status === 'success' ? (
                    <p className="m-0 text-sm text-[#4a5768]">
                        {i18n.t(
                            '{{readings}} readings across {{elements}} of {{total}} data elements',
                            {
                                readings,
                                elements: recorded.length,
                                total: ids.length,
                                interpolation: { escapeValue: false },
                            }
                        )}
                    </p>
                ) : null}
            </header>
            {observations.error ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {observations.error.message}
                    </AlertDescription>
                </Alert>
            ) : null}
            <section aria-labelledby="observation-cards-trends">
                <h2
                    id="observation-cards-trends"
                    className="mt-0 mb-3 text-base font-medium"
                >
                    {i18n.t('Trends')}
                </h2>
                <div className={CARD_GRID}>
                    {preset.trend.map((id) => (
                        <TrendCard
                            key={id}
                            observation={observations.get(id)}
                            unit={preset.units[id]}
                        />
                    ))}
                </div>
            </section>
            <section aria-labelledby="observation-cards-latest">
                <h2
                    id="observation-cards-latest"
                    className="mt-0 mb-3 text-base font-medium"
                >
                    {i18n.t('Last recorded')}
                </h2>
                <div className={CARD_GRID}>
                    {preset.latest.map((id) => (
                        <LatestValueCard
                            key={id}
                            observation={observations.get(id)}
                            unit={preset.units[id]}
                            staleAfterDays={preset.staleAfterDays}
                        />
                    ))}
                </div>
            </section>
        </>
    )
}

export const ObservationCardsDemo = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const preset = findPreset(searchParams.get('preset'))
    const trackedEntityId = searchParams.get('te') ?? ''
    const view: View =
        searchParams.get('view') === 'examples' ? 'examples' : 'live'
    const [draft, setDraft] = useState(trackedEntityId)
    const engine = useDataEngine()
    const [candidates, setCandidates] = useState<ExamplePatient[]>([])
    const [finding, setFinding] = useState<'idle' | 'busy' | 'none' | 'error'>(
        'idle'
    )

    useEffect(() => setDraft(trackedEntityId), [trackedEntityId])
    // Candidates belong to the program they were found in.
    useEffect(() => {
        setCandidates([])
        setFinding('idle')
    }, [preset.id])

    const update = (presetId: string, te: string, next: View = view) =>
        setSearchParams(new URLSearchParams(buildSearch(presetId, te, next)))

    const loadExample = async () => {
        setFinding('busy')
        try {
            const found = await findExamplePatients(engine, preset.programId, [
                ...preset.trend,
                ...preset.latest,
            ])
            setCandidates(found)
            if (found.length === 0) {
                setFinding('none')
                return
            }
            setFinding('idle')
            update(preset.id, found[0].trackedEntityId, 'live')
        } catch {
            setFinding('error')
        }
    }

    return (
        <div
            className="min-h-screen bg-[#f3f5f7] pb-10"
            data-testid="observation-cards-demo"
        >
            <main className="mx-auto mt-6 grid w-[min(1100px,calc(100%-32px))] gap-6 rounded border border-[#d5dde5] bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="m-0 text-xs font-semibold tracking-wide text-[#6c7787] uppercase">
                            {i18n.t('Component demo')}
                        </p>
                        <h1 className="mt-1 mb-2 text-2xl font-medium text-[#212934]">
                            {i18n.t('Observation cards')}
                        </h1>
                        <p className="m-0 max-w-2xl text-sm leading-6 text-[#4a5768]">
                            {i18n.t(
                                "Read-only cards for a tracked entity's latest readings and trends."
                            )}
                        </p>
                    </div>
                    <a
                        className="text-sm font-medium text-dhis2-primary underline-offset-2 hover:underline"
                        href="#/"
                    >
                        {i18n.t('Back to Working List')}
                    </a>
                </div>

                <div
                    role="tablist"
                    className="flex gap-4 border-b border-[#d5dde5]"
                >
                    {(
                        [
                            ['live', i18n.t('Live data')],
                            ['examples', i18n.t('All demo examples')],
                        ] as const
                    ).map(([id, text]) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={view === id}
                            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
                                view === id
                                    ? 'border-dhis2-primary text-dhis2-primary'
                                    : 'border-transparent text-[#4a5768]'
                            }`}
                            onClick={() =>
                                update(preset.id, trackedEntityId, id)
                            }
                        >
                            {text}
                        </button>
                    ))}
                </div>

                {view === 'examples' ? (
                    <ExamplesGallery />
                ) : (
                    <>
                        <form
                            className="flex flex-wrap items-end gap-4"
                            onSubmit={(event) => {
                                event.preventDefault()
                                update(preset.id, draft.trim())
                            }}
                        >
                            <label className="grid gap-1 text-sm font-medium text-[#364152]">
                                {i18n.t('Preset')}
                                <select
                                    className="min-w-64 rounded border border-[#a0adba] bg-white px-3 py-2 font-normal text-[#212934]"
                                    value={preset.id}
                                    onChange={(event) =>
                                        update(
                                            event.target.value,
                                            trackedEntityId
                                        )
                                    }
                                >
                                    {OBSERVATION_PRESETS.map((option) => (
                                        <option
                                            key={option.id}
                                            value={option.id}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="grid gap-1 text-sm font-medium text-[#364152]">
                                {i18n.t('Tracked entity ID')}
                                <input
                                    className="min-w-56 rounded border border-[#a0adba] bg-white px-3 py-2 font-normal text-[#212934]"
                                    type="text"
                                    value={draft}
                                    onChange={(event) =>
                                        setDraft(event.target.value)
                                    }
                                    autoComplete="off"
                                    spellCheck={false}
                                />
                            </label>
                            <Button type="submit">
                                {i18n.t('Show observations')}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={finding === 'busy'}
                                onClick={loadExample}
                            >
                                {finding === 'busy'
                                    ? i18n.t('Finding a person…')
                                    : i18n.t('Load example')}
                            </Button>
                        </form>
                        {finding === 'none' ? (
                            <p className="m-0 text-sm text-[#4a5768]">
                                {i18n.t(
                                    'No one in this program has values for these data elements.'
                                )}
                            </p>
                        ) : null}
                        {finding === 'error' ? (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {i18n.t(
                                        "Couldn't look for an example person"
                                    )}
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        {candidates.length > 1 ? (
                            <p className="m-0 flex flex-wrap items-center gap-x-3 text-sm text-[#4a5768]">
                                {i18n.t('Other examples:')}
                                {candidates.map((candidate) => (
                                    <Link
                                        key={candidate.trackedEntityId}
                                        className={LINK_CLASS}
                                        to={{
                                            search: buildSearch(
                                                preset.id,
                                                candidate.trackedEntityId
                                            ),
                                        }}
                                    >
                                        {candidate.trackedEntityId}
                                    </Link>
                                ))}
                            </p>
                        ) : null}

                        {trackedEntityId === '' ? (
                            <div className="grid gap-2 text-sm text-[#4a5768]">
                                <p className="m-0">
                                    {i18n.t(
                                        'Enter a tracked entity ID to see their observations.'
                                    )}
                                </p>
                                {preset.suggestedTrackedEntityId ? (
                                    <p className="m-0">
                                        <Link
                                            className={LINK_CLASS}
                                            to={{
                                                search: buildSearch(
                                                    preset.id,
                                                    preset.suggestedTrackedEntityId
                                                ),
                                            }}
                                        >
                                            {i18n.t('Use {{id}}', {
                                                id: preset.suggestedTrackedEntityId,
                                                interpolation: {
                                                    escapeValue: false,
                                                },
                                            })}
                                        </Link>
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <PresetObservations
                                preset={preset}
                                trackedEntityId={trackedEntityId}
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    )
}
