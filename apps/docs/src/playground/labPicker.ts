import { createContext, type ReactNode } from 'react'

/** What opens a lab's settings: the playground's block picker, so a lab never knows which page it is on. */
export const LabPicker = createContext<ReactNode>(undefined)
