import type { ComponentProps } from 'react'
import type {
    TimelineConnector,
    TimelineEmpty,
    TimelineError,
    TimelineFeed,
    TimelineGroupHeading,
    TimelineItem,
    TimelineLoading,
    TimelineMarker,
    TimelineNotices,
    TimelineNow,
    TimelineShowMore,
    TimelineTime,
} from '..'

// The parts are plain function components on React 18: a `ref` would be
// dropped without a word, so their props refuse one.
export type PartsTakeNoRef = [
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineConnector>['ref'],
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineEmpty>['ref'],
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineError>['ref'],
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineFeed>['ref'],
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineGroupHeading>['ref'],
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineItem>['ref'],
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineLoading>['ref'],
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineMarker>['ref'],
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineNotices>['ref'],
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineNow>['ref'],
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineShowMore>['ref'],
    // @ts-expect-error parts take no ref
    ComponentProps<typeof TimelineTime>['ref'],
]
