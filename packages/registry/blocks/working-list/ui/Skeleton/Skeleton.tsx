import React from 'react'

// Same literal divider colour as the block's own borders. Callers size and
// round each block to the element it stands in for.
export const SkeletonBlock = ({ className }: { className: string }) => (
    <span
        aria-hidden="true"
        className={`inline-block max-w-full animate-pulse bg-[#e8edf2] align-middle motion-reduce:animate-none ${className}`}
    />
)

// Matches the generated default views (active, completed, cancelled) so the
// bar keeps its height and rhythm when the real chips arrive.
const savedViewPillWidths = ['w-[132px]', 'w-[160px]', 'w-[152px]']

export const SavedViewsSkeleton = () => (
    <div
        className="flex min-w-0 flex-wrap items-center gap-1 border-b border-[#e8edf2] px-2 pt-0 pb-2"
        data-testid="saved-list-bar"
    >
        {savedViewPillWidths.map((width) => (
            <SkeletonBlock
                key={width}
                className={`h-[30px] rounded-2xl ${width}`}
            />
        ))}
    </div>
)
