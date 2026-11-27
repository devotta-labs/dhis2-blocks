import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import { cn } from '@/components/dhis2/ui/cn'
import type { LocationMapProps } from './types'

// Leaflet and its styles are fetched when a map is first drawn, so a page without one carries none of it.
const LeafletMap = lazy(() => import('./LeafletMap'))

/**
 * A point or an area on a map. Without `onChange` it only shows; with it, the point or area can be placed and
 * changed by pointer or keyboard. Give it a size with `className`; it is 24rem tall otherwise.
 */
export const LocationMap = (props: LocationMapProps) => (
    <Suspense
        fallback={
            <Skeleton
                className={cn(
                    'h-[var(--location-map-height,24rem)] w-full',
                    props.className
                )}
            />
        }
    >
        <LeafletMap {...props} />
    </Suspense>
)
