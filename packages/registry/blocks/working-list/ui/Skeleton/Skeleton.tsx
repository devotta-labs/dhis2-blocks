import React from 'react'

export const SkeletonBlock = ({ className }: { className: string }) => (
    <span
        aria-hidden="true"
        className={`inline-block max-w-full animate-pulse bg-dhis2-accent-strong align-middle motion-reduce:animate-none ${className}`}
    />
)

const savedViewPillWidths = ['w-[132px]', 'w-[160px]', 'w-[152px]']

export const SavedViewsSkeleton = () => (
    <div
        className="flex min-w-0 flex-wrap items-center gap-1 border-b border-dhis2-border px-2 pt-0 pb-2"
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
