# Register fixtures

Captured on 2026-11-03 from the docs DHIS2 (Sierra Leone demo, version 2.42), started with `pnpm docs:up`. Run from
the repository root:

```bash
D=packages/registry/blocks/tracker-data-entry/register/__tests__/fixtures; B=http://127.0.0.1:58080/api
P='id,displayName,displayIncidentDate,displayEnrollmentDateLabel,displayIncidentDateLabel,expiryPeriodType,expiryDays,completeEventsExpiryDays,access[data[write]],categoryCombo[isDefault],trackedEntityType[id,access[data[write]]],programTrackedEntityAttributes[mandatory,trackedEntityAttribute[id,displayFormName,valueType,fieldMask,generated,unique,optionSet[options[code,displayName]]]],programStages[id,displayName,repeatable,validationStrategy,autoGenerateEvent,minDaysFromStart,generatedByEnrollmentDate,reportDateToUse,openAfterEnrollment,blockEntryForm,access[data[write]],programStageDataElements[compulsory,dataElement[id,displayFormName,valueType,fieldMask,optionSet[options[code,displayName]]]],programStageSections[id,dataElements[id]]]'
for p in WSGAb5XwJ3Y:rmnch-register ImmReg00001:immunisation; do
  curl -s -u admin:district -G "$B/programs/${p%%:*}" --data-urlencode "fields=$P" \
    | jq '(.. | objects | select(has("options")) | .options) |= .[:20]' > "$D/${p##*:}-program.json"
done
E='enrollment,trackedEntity,orgUnit,enrolledAt,occurredAt,status,attributes[attribute,value],events[event,enrollment,programStage,orgUnit,occurredAt,scheduledAt,completedAt,status,dataValues[dataElement,value]]'
curl -s -u admin:district -G "$B/tracker/enrollments" --data-urlencode program=ImmReg00001 \
  --data-urlencode orgUnits=DiszpKrYNg8 --data-urlencode orgUnitMode=SELECTED \
  --data-urlencode enrolledAfter=2026-10-01 --data-urlencode enrolledBefore=2026-10-31 \
  --data-urlencode order=enrolledAt:asc --data-urlencode pageSize=25 --data-urlencode "fields=$E" \
  > "$D/immunisation-enrollments.json"
pnpm exec oxfmt --write $D
```

`immunisation-enrollments.json` is the first page `registerSource` asks for in October 2026: the three seeded children.

`ImmReg00001` is the child immunisation register the e2e seed creates. Each option set keeps its first 20 options.
