import React, { type ReactNode } from 'react'

export interface WorkingListToolbarProps {
    children: ReactNode
}

export const WorkingListToolbar = ({ children }: WorkingListToolbarProps) => (
    <div
        className="flex min-w-0 max-w-full items-start gap-2 border-b border-[#e8edf2] px-2 py-3 [@media(max-width:560px)]:flex-col [@media(max-width:560px)]:items-stretch [&_[data-test='configure-columns']]:h-8 [&_[data-test^='more-filters-']]:h-8"
        data-testid="working-list-toolbar"
    >
        {children}
    </div>
)
