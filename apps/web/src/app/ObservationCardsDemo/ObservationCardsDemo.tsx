import { Alert, AlertDescription } from '@/registry/dhis2/ui/alert'
import { Button } from '@/registry/dhis2/ui/button'
import {
    LatestValueCard,
    TrendCard,
    useTrackedEntityObservations,
} from '@dhis2-blocks/observation-cards'
import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { OBSERVATION_PRESETS, type ObservationPreset } from './presets'

const CARD_GRID = 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]'

const findPreset = (id: string | null): ObservationPreset =>
    OBSERVATION_PRESETS.find((preset) => preset.id === id) ??
    OBSERVATION_PRESETS[0]

const buildSearch = (presetId: string, trackedEntityId: string) => {
    const params = new URLSearchParams({ preset: presetId })
    if (trackedEntityId !== '') {
        params.set('te', trackedEntityId)
    }
    return `?${params.toString()}`
}

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

    return (
        <>
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
    const [draft, setDraft] = useState(trackedEntityId)

    useEffect(() => setDraft(trackedEntityId), [trackedEntityId])

    const update = (presetId: string, te: string) =>
        setSearchParams(new URLSearchParams(buildSearch(presetId, te)))

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
                        className="text-sm font-medium text-[#147cd7] underline-offset-2 hover:underline"
                        href="#/"
                    >
                        {i18n.t('Back to Working List')}
                    </a>
                </div>

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
                                update(event.target.value, trackedEntityId)
                            }
                        >
                            {OBSERVATION_PRESETS.map((option) => (
                                <option key={option.id} value={option.id}>
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
                            onChange={(event) => setDraft(event.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </label>
                    <Button type="submit">{i18n.t('Show observations')}</Button>
                </form>

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
                                    className="font-medium text-[#147cd7] underline-offset-2 hover:underline"
                                    to={{
                                        search: buildSearch(
                                            preset.id,
                                            preset.suggestedTrackedEntityId
                                        ),
                                    }}
                                >
                                    {i18n.t('Use {{id}}', {
                                        id: preset.suggestedTrackedEntityId,
                                        interpolation: { escapeValue: false },
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
            </main>
        </div>
    )
}
