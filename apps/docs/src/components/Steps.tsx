import type { ReactNode } from 'react'

/** Numbers each `###` heading inside it as a step; styles live in index.css. */
export const Steps = ({ children }: { children: ReactNode }) => (
    <div className="docs-steps">{children}</div>
)
