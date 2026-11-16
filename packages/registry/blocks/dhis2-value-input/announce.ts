import i18n from '@dhis2/d2-i18n'
import { useEffect } from 'react'
import { announce as announceInHouse } from '@/components/dhis2/ui/announcer'
import type { Politeness } from '@/components/dhis2/ui/announcer'

export const formatCount = (count: number) => {
    try {
        // DHIS2 writes locales as `en_US`; Intl expects `en-US`.
        return new Intl.NumberFormat(i18n.language.replace('_', '-')).format(
            count
        )
    } catch {
        // A locale Intl still cannot read.
        return String(count)
    }
}

/** "Showing … of … matches", when more match than a list draws; empty otherwise. */
export const matchCount = (shown: number, total: number) =>
    total > shown
        ? i18n.t('Showing {{shown}} of {{total}} matches', {
              shown: formatCount(shown),
              total: formatCount(total),
          })
        : ''

/** Says `text` through `announce` (the shared announcer by default) when it changes, not on every keystroke. */
export const useAnnounced = (
    text: string,
    announce: (text: string, politeness?: Politeness) => void = announceInHouse
) => {
    useEffect(() => {
        if (text !== '') {
            announce(text)
        }
    }, [text, announce])
}
