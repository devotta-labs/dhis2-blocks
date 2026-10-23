import { useDataQuery } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useId, useMemo } from 'react'
import { z } from 'zod'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    ProfileWidget,
    ProfileWidgetContent,
    ProfileWidgetField,
    ProfileWidgetFieldList,
    ProfileWidgetHeader,
    ProfileWidgetTitle,
    ProfileWidgetValue,
    TrackedEntityNotAccessibleError,
    useProfileFields,
    useTrackedEntityProfile,
    type ProfileField,
    type ProfileFieldInput,
    type TrackedEntityAttributeField,
} from '@/components/profile-widget'

const TRACKED_ENTITY_ID = 'WlE2eTei003'
const PROGRAM_ID = 'WlE2ePrg001'
const PROGRAM_STAGE_ID = 'WlE2eStg001'
const EVENT_ID = 'WlE2eEvt003'

const selectFilledAttributes = (
    attributes: readonly TrackedEntityAttributeField[]
): readonly ProfileField[] =>
    attributes.filter((attribute) => attribute.value.kind !== 'empty')

const visitQuery = {
    event: {
        resource: 'tracker/events',
        id: EVENT_ID,
        params: { fields: 'event,dataValues[dataElement,value]' },
    },
    stage: {
        resource: 'programStages',
        id: PROGRAM_STAGE_ID,
        params: {
            fields: 'programStageDataElements[displayInReports,dataElement[id,displayFormName,valueType,optionSet[options[code,displayName]]]]',
        },
    },
}

const visitResponse = z.object({
    event: z.object({
        event: z.string(),
        dataValues: z.array(
            z.object({ dataElement: z.string(), value: z.string() })
        ),
    }),
    stage: z.object({
        programStageDataElements: z.array(
            z.object({
                displayInReports: z.boolean().optional(),
                dataElement: z.object({
                    id: z.string(),
                    displayFormName: z.string(),
                    valueType: z.string(),
                    optionSet: z
                        .object({
                            options: z.array(
                                z.object({
                                    code: z.string(),
                                    displayName: z.string(),
                                })
                            ),
                        })
                        .optional(),
                }),
            })
        ),
    }),
})

function toVisitInputs(
    response: z.infer<typeof visitResponse>
): ProfileFieldInput[] {
    const values = new Map(
        response.event.dataValues.map((dataValue) => [
            dataValue.dataElement,
            dataValue.value,
        ])
    )

    return response.stage.programStageDataElements
        .filter((stageDataElement) => stageDataElement.displayInReports)
        .map(({ dataElement }) => ({
            id: dataElement.id,
            label: dataElement.displayFormName,
            valueType: dataElement.valueType,
            value: values.get(dataElement.id) ?? null,
            options: dataElement.optionSet?.options,
            fileEndpoint: `tracker/events/${response.event.event}/dataValues/${dataElement.id}`,
        }))
}

function CurrentVisitFields() {
    const headingId = useId()
    const visit = useDataQuery(visitQuery)
    const parsed = useMemo(
        () => (visit.data ? visitResponse.safeParse(visit.data) : undefined),
        [visit.data]
    )
    const inputs = useMemo(
        () => (parsed?.success ? toVisitInputs(parsed.data) : undefined),
        [parsed]
    )
    const { data: visitFields, error, isPending } = useProfileFields(inputs)

    if (visit.error || parsed?.success === false || error) {
        return <ErrorAlert title={i18n.t('This visit could not be loaded')} />
    }

    if (isPending || !visitFields) {
        return <Spinner aria-label={i18n.t('Loading visit')} />
    }

    if (visitFields.length === 0) {
        return null
    }

    return (
        <section aria-labelledby={headingId} className="mt-3">
            <h3
                id={headingId}
                className="m-0 mb-1 text-sm font-medium text-dhis2-grey-800"
            >
                {i18n.t('This visit')}
            </h3>
            <ProfileWidgetFieldList aria-labelledby={headingId}>
                {visitFields.map((field) => (
                    <ProfileWidgetField key={field.id} label={field.label}>
                        <ProfileWidgetValue value={field.value} />
                    </ProfileWidgetField>
                ))}
            </ProfileWidgetFieldList>
        </section>
    )
}

const ProfileWidgetVisit = () => {
    const { data, error, isPending } = useTrackedEntityProfile({
        trackedEntityId: TRACKED_ENTITY_ID,
        programId: PROGRAM_ID,
        selectFields: selectFilledAttributes,
    })

    const renderAttributes = () => {
        if (isPending) {
            return (
                <Spinner
                    className="size-6 border-4"
                    aria-label={i18n.t('Loading profile')}
                />
            )
        }

        if (error instanceof TrackedEntityNotAccessibleError) {
            return (
                <ErrorAlert
                    title={i18n.t(
                        'This record is not enrolled in the program, or you do not have access to it'
                    )}
                />
            )
        }

        if (error || !data) {
            return (
                <ErrorAlert
                    title={i18n.t(
                        'Profile widget could not be loaded. Please try again later'
                    )}
                />
            )
        }

        return (
            <ProfileWidgetFieldList>
                {data.fields.map((field) => (
                    <ProfileWidgetField key={field.id} label={field.label}>
                        <ProfileWidgetValue value={field.value} />
                    </ProfileWidgetField>
                ))}
            </ProfileWidgetFieldList>
        )
    }

    return (
        <ProfileWidget className="max-w-xl">
            <ProfileWidgetHeader>
                <ProfileWidgetTitle>
                    {data?.title ?? i18n.t('Profile')}
                </ProfileWidgetTitle>
            </ProfileWidgetHeader>
            <ProfileWidgetContent>
                {renderAttributes()}
                <CurrentVisitFields />
            </ProfileWidgetContent>
        </ProfileWidget>
    )
}

export default ProfileWidgetVisit
