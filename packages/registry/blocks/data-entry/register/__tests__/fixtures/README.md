# Register fixtures

Captured on 2026-11-03 from the docs DHIS2 (Sierra Leone demo, version 2.42), started with `pnpm docs:up`. Run from
the repository root:

```bash
D=packages/registry/blocks/data-entry/register/__tests__/fixtures; B=http://127.0.0.1:58080/api
P='id,displayName,displayIncidentDate,displayEnrollmentDateLabel,displayIncidentDateLabel,trackedEntityType[id],programTrackedEntityAttributes[mandatory,trackedEntityAttribute[id,displayFormName,valueType,fieldMask,generated,unique,optionSet[options[code,displayName]]]],programStages[id,displayName,repeatable,validationStrategy,autoGenerateEvent,minDaysFromStart,generatedByEnrollmentDate,reportDateToUse,openAfterEnrollment,programStageDataElements[compulsory,dataElement[id,displayFormName,valueType,fieldMask,optionSet[options[code,displayName]]]]]'
for p in WSGAb5XwJ3Y:rmnch-register ImmReg00001:immunisation; do
  curl -s -u admin:district -G "$B/programs/${p%%:*}" --data-urlencode "fields=$P" \
    | jq '(.. | objects | select(has("options")) | .options) |= .[:20]' > "$D/${p##*:}-program.json"
done
pnpm exec oxfmt --write $D
```

`ImmReg00001` is the child immunisation register the e2e seed creates. Each option set keeps its first 20 options.
