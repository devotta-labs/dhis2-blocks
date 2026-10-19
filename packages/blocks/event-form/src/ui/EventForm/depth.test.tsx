import * as uiAlert from '@/registry/dhis2/ui/alert'
import * as uiAlertDialog from '@/registry/dhis2/ui/alert-dialog'
import * as uiCard from '@/registry/dhis2/ui/card'
import * as uiSpinner from '@/registry/dhis2/ui/spinner'
import * as eventFormActions from '../EventFormActions'
import * as eventFormDetails from '../EventFormDetails'
import * as eventFormDialogs from '../EventFormDialogs'
import * as eventFormFeedback from '../EventFormFeedback'
import * as eventFormNotes from '../EventFormNotes'
import * as eventFormRuleNotice from '../EventFormRuleNotice'
import * as eventFormSection from '../EventFormSection'
import * as eventFormSectionNav from '../EventFormSectionNav'
import * as eventFormSections from '../EventFormSections'
import * as eventFormStatusNotice from '../EventFormStatusNotice'
import { found, OWN_COMPONENTS } from '../fields/fieldTestSupport'
import * as eventForm from './EventForm'
import { EventForm } from './EventForm'
import * as eventFormProvider from './EventFormProvider'
import { renderEventForm, RMNCH } from './eventFormTestSupport'

interface FiberLike {
    type?: object | null
    elementType?: object | null
    return: FiberLike | null
}

const fiberOf = (element: Element): FiberLike | undefined => {
    const entry = Object.entries(element).find(([name]) =>
        name.startsWith('__reactFiber$')
    )
    // SAFETY: React stores the element's fiber under the `__reactFiber$…` key.
    return entry?.[1] as FiberLike | undefined
}

/*
 * Spec §12: count the components authored in this block and its primitives on the path from
 * EventForm to the element; Base UI internals and context providers don't count. So
 * EventFormProvider (it only provides the form's contexts), EventFormTextProvider and
 * CalendarInputProvider are left out, and everything else this block exports is in.
 */
const PROVIDERS = new Set<unknown>([eventFormProvider.EventFormProvider])
const COUNTED = new Set<unknown>(
    [
        ...OWN_COMPONENTS,
        ...[
            eventForm,
            eventFormProvider,
            eventFormActions,
            eventFormDetails,
            eventFormDialogs,
            eventFormFeedback,
            eventFormNotes,
            eventFormRuleNotice,
            eventFormSection,
            eventFormSectionNav,
            eventFormSections,
            eventFormStatusNotice,
            uiAlert,
            uiAlertDialog,
            uiCard,
            uiSpinner,
        ].flatMap((module) => Object.values(module)),
    ].filter((component) => !PROVIDERS.has(component))
)

/** Own components from EventForm down to the element, both ends included. */
const depthFromEventForm = (element: Element): number => {
    let depth = 0
    let fiber = fiberOf(element)
    while (fiber) {
        if (COUNTED.has(fiber.type) || COUNTED.has(fiber.elementType)) {
            depth += 1
        }
        if (fiber.elementType === EventForm || fiber.type === EventForm) {
            return depth
        }
        fiber = fiber.return ?? undefined
    }
    throw new Error('EventForm is not an ancestor of the element')
}

describe('component depth', () => {
    it('every input is under 10 own components from EventForm', async () => {
        const { screen } = await renderEventForm({ eventId: RMNCH.eventId })
        const inputs = [
            ...screen.container.querySelectorAll(
                '[data-field-id] input, [data-field-id] textarea, [data-field-id] button, [data-field-id] [role=radio], textarea'
            ),
        ]
        // Every widget kind RMNCH uses: toggles, text, numbers, dates, selects and the details.
        expect(inputs.length).toBeGreaterThan(40)
        const depths = inputs.map((input) => depthFromEventForm(input))
        expect(Math.max(...depths)).toBeLessThan(10)
        const lmp = found(
            screen.container.querySelector(
                `[data-field-id="${RMNCH.lmp}"] input`
            )
        )
        // EventForm, EventFormSections, EventFormSection, then the field's own path.
        expect(depthFromEventForm(lmp)).toBeLessThanOrEqual(9)
    })
})
