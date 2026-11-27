import {
    LocationInput,
    type LocationOrgUnit,
    type Locator,
    type PlaceSearch,
} from '@/components/location-input'
import {
    LocationMap,
    type LocationGeometry,
    type MapGeometry,
    type MapTiles,
} from '@/components/location-map'
import type { FeatureType } from './labData'

interface Props {
    /** Which use of the blocks is on show. */
    view: 'input' | 'map' | 'event'
    /** What is captured; absent for a stage that records no location. */
    capture?: 'point' | 'area'
    /** The program stage's feature type, for the event view. */
    featureType: FeatureType
    value: MapGeometry | null
    orgUnit?: LocationOrgUnit
    warnKm?: number
    readOnly?: string
    search?: PlaceSearch
    tiles: MapTiles | null
    locator: Locator
    onChange: (value: LocationGeometry | null) => void
}

/**
 * The event's own location as /api/tracker takes it. Its type must be the stage's feature type or the import is
 * refused (E1012), so an area drawn for a MULTI_POLYGON stage goes as a multi-polygon of one part.
 */
const sentGeometry = (featureType: FeatureType, value: MapGeometry | null) =>
    value?.type === 'Polygon' && featureType === 'MULTI_POLYGON'
        ? { type: 'MultiPolygon', coordinates: [value.coordinates] }
        : value

/** A stored geometry as the field edits it: a multi-polygon of one part comes back a polygon. */
const editableGeometry = (stored: MapGeometry | null): MapGeometry | null => {
    const [only, ...more] =
        stored?.type === 'MultiPolygon' ? stored.coordinates : []
    return only !== undefined && more.length === 0
        ? { type: 'Polygon', coordinates: only }
        : stored
}

/** The location blocks as an app would use them: the input in a form, the map alone, and an event's own location. */
export const LocationCanvas = ({
    view,
    capture,
    featureType,
    value,
    orgUnit,
    warnKm,
    readOnly,
    search,
    tiles,
    locator,
    onChange,
}: Props) => {
    const references = orgUnit?.geometry
        ? [{ name: orgUnit.name, geometry: orgUnit.geometry }]
        : []

    if (view === 'map') {
        return (
            <div className="grid w-full gap-6 md:grid-cols-2">
                <figure className="m-0 flex flex-col gap-2">
                    <figcaption className="text-sm font-medium">
                        Read-only
                    </figcaption>
                    <LocationMap
                        value={value}
                        references={references}
                        tiles={tiles}
                        className="h-64"
                    />
                </figure>
                <figure className="m-0 flex flex-col gap-2">
                    <figcaption className="text-sm font-medium">
                        Editable
                    </figcaption>
                    <LocationMap
                        capture={capture}
                        value={value}
                        onChange={readOnly ? undefined : onChange}
                        references={references}
                        tiles={tiles}
                        className="h-64"
                    />
                </figure>
            </div>
        )
    }

    if (view === 'input' && capture !== undefined) {
        return (
            <div className="w-full max-w-md">
                <LocationInput
                    label={
                        capture === 'point'
                            ? 'Household location'
                            : 'Spray area'
                    }
                    capture={capture}
                    value={value}
                    onChange={onChange}
                    orgUnit={orgUnit}
                    warnKm={warnKm}
                    readOnly={readOnly}
                    search={search}
                    tiles={tiles}
                    locator={locator}
                />
            </div>
        )
    }

    // The event's own location: the stage's feature type picks the field, and `event.geometry` is its value.
    const event = {
        event: 'Kx7bR2pQ9wF',
        programStage: 'Zj7UnCAulEk',
        orgUnit: 'DiszpKrYNg8',
        occurredAt: '2026-11-27',
        geometry: sentGeometry(featureType, value),
    }
    return (
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            <section className="flex flex-col gap-4 self-start rounded-dhis2-md border border-dhis2-border bg-dhis2-background p-4">
                <h3 className="m-0 text-sm font-semibold">Household visit</h3>
                {capture === undefined ? (
                    <p className="m-0 text-sm text-dhis2-muted-foreground">
                        featureType NONE: no location field
                    </p>
                ) : (
                    <LocationInput
                        label={capture === 'point' ? 'Coordinate' : 'Area'}
                        capture={capture}
                        value={editableGeometry(value)}
                        onChange={onChange}
                        orgUnit={orgUnit}
                        warnKm={warnKm}
                        readOnly={readOnly}
                        search={search}
                        tiles={tiles}
                        locator={locator}
                    />
                )}
            </section>
            <figure className="m-0 flex min-w-0 flex-col gap-2">
                <figcaption className="text-sm font-medium">
                    Sent to /api/tracker, stage featureType {featureType}
                </figcaption>
                <pre className="m-0 overflow-x-auto rounded-dhis2-md bg-dhis2-background-subtle p-3 font-mono text-xs leading-relaxed">
                    {JSON.stringify(
                        {
                            events: [
                                capture === undefined
                                    ? { ...event, geometry: undefined }
                                    : event,
                            ],
                        },
                        null,
                        2
                    )}
                </pre>
            </figure>
        </div>
    )
}
