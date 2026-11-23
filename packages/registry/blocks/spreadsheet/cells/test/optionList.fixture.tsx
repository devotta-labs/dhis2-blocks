import React from 'react'
import { OptionList } from '../OptionList'

/** Two matches, the first one highlighted for Enter. */
export const TwoOptions = () => (
    <OptionList
        id="list"
        labelledBy="header"
        codes={['A', 'B']}
        names={
            new Map([
                ['A', 'Alpha'],
                ['B', 'Beta'],
            ])
        }
        active={0}
        count=""
        optionId={(code) => `option-${code}`}
        onPick={() => {}}
    />
)
