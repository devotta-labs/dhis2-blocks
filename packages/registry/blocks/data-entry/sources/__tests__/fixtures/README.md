# Event source fixtures

Captured on 2026-10-26 from the docs DHIS2 (Sierra Leone demo, version 2.42.6, revision dd8bdbb), started with
`pnpm docs:up`. Run from the repository root:

```bash
D=packages/registry/blocks/data-entry/sources/__tests__/fixtures; B=http://127.0.0.1:58080/api
P='id,displayName,programType,expiryPeriodType,expiryDays,completeEventsExpiryDays,categoryCombo[id,isDefault],programStages[id,displayName,repeatable,validationStrategy,blockEntryForm,access[data[write]],programStageDataElements[compulsory,dataElement[id,displayFormName,valueType,fieldMask,optionSet[options[code,displayName]]]]]'
E='event,enrollment,program,programStage,orgUnit,occurredAt,scheduledAt,completedAt,status,attributeOptionCombo,dataValues[dataElement,value]'
curl -s -u admin:district "$B/me?fields=id,authorities" > $D/me-admin.json
curl -s -u admin:district -G "$B/programs/eBAyeGv0exc" --data-urlencode "fields=$P" | jq '(.. | objects | select(has("options")) | .options) |= .[:20]' > $D/inpatient-program.json
curl -s -u admin:district -G "$B/tracker/events" -d program=eBAyeGv0exc -d orgUnit=DiszpKrYNg8 -d pageSize=5 -d order=occurredAt:desc --data-urlencode "fields=$E" > $D/inpatient-events.json
curl -s -u admin:district -G "$B/programs/WSGAb5XwJ3Y" --data-urlencode "fields=$P" > $D/rmnch-program.json
curl -s -u admin:district -G "$B/tracker/events" -d program=WSGAb5XwJ3Y -d enrollments=PE6abx7Zhn0 -d pageSize=50 -d order=occurredAt:asc --data-urlencode "fields=$E" > $D/rmnch-person-events.json
pnpm exec oxfmt --write $D
```

`inpatient-program.json` keeps only the first 20 options of each option set. The diagnosis option set has 14,240
options, and the full response is 3.2 MB once formatted.
