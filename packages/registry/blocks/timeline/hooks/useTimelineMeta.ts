import { useContext } from 'react'
import { TimelineMetaContext } from '../ui/TimelineContext'

/** Calendar, locale and today from the surrounding `Timeline` or `TimelineMetaProvider`. */
export const useTimelineMeta = () => {
    const meta = useContext(TimelineMetaContext)
    if (meta === null) {
        throw new Error(
            'Timeline parts must be used within Timeline or TimelineMetaProvider.'
        )
    }
    return meta
}
