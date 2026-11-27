# Event Form

Enter or edit one event of a program stage, with every program rule applied.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/event-form
```

`EventForm` loads the stage's sections and data elements, shows each through `ValueInput` (a coordinate through
`LocationInput`), and runs the stage's program
rules on every commit: a rule hides a field or section, sets a value, makes a field required, limits options or shows a
message. Save sends the event in one tracker import, Complete sends it completed, and DHIS2's errors land on the shown
fields they name. Until DHIS2 answers, every field is read-only, drawn as it was; after 15 seconds the form offers
`Stop waiting`, and then ignores the late answer. A save shows `Saved` by the buttons until the next edit
(`confirmSaved="off"` for a host that confirms its own way). Give it `eventId` to edit an event; without it the form creates one at `orgUnitId`. It needs the DHIS2
app-runtime provider and a React Query `QueryClientProvider`. The stage and its rules load together, behind a skeleton,
so the form opens ready to type in.

```tsx
<EventForm
    programId={programId}
    programStageId={stageId}
    orgUnitId={orgUnitId}
    enrollmentId={enrollmentId}
    onSaved={({ eventId, status }) => close(eventId, status)}
    onDirtyChange={setDirty}
/>
```

A field a rule set, made required or gave fewer options has one marker beside its label (`Set automatically`,
`Required here` or `Fewer options`, `blame="markers"`, the default) that opens why: what each rule did in plain words
(`Set to 300 because Weight (kg) is 150.`), the answers it read, each on the form a button to its field, then what it
read outside the form as plain text with where it came from (`Birth date (from the enrolment): Jan 18, 1991`,
`Smoking (Care at birth): Yes`), the rule's name, and its condition behind `Show rule`. Rule messages show under the
field without the rule's name, a warning or an error after the word `Warning:` or `Error:`; a field the rules only give
messages has no marker. A set field is read-only, its reason (`Set by rule "Paracetamol dose" because Weight (kg) is
150`) read with it by screen readers, and Tab passes it for its marker. Fields and sections a rule hid are listed at the
end of their section, closed until pressed. A field or section a rule stops hiding simply appears. After each change,
screen readers hear what the rules changed (`Pregnant shown.`). With `blame="off"` the rules apply the same, a set field
reads `Set by a program rule`, hidden fields simply leave the form, and the changes are still announced. An empty
required field says `Required` only after a Save or Complete it held back. When a commit removes the focused element,
focus goes on to the next field.

A date or date-and-time data element the stage does not allow future dates for (`allowFutureDate` off, DHIS2's default)
says `A date in the future is not allowed` under a value whose day is after today, as soon as it holds one, and holds
back Save and Complete under either validation strategy; DHIS2 itself would store it. The event date takes any day, as
in the Capture app.

A program with a non-default category combination gets one required choice per category after the event date, offering
only the options the user may write to, that apply to the org unit (or an ancestor) and whose dates include the event
date. A chosen option the event date no longer covers stays, says why and holds back Save. The choices are sent as
`attributeCategoryOptions`. Programs with the default combination show none.

A stage whose feature type is `POINT`, `POLYGON` or `MULTI_POLYGON` gets a location field after the categories, not
required: `LocationInput` from `location-input`, a `Coordinate` for a point stage and an `Area` for the others, placed
against the event's org unit, whose name and geometry the form fetches. With `locationWarnKm`, a point further than
that from a point org unit is a warning, never a reason to hold back Save. The location is sent as the event's
`geometry`, of the stage's feature type since DHIS2 refuses any other (E1012): an area goes to a `MULTI_POLYGON` stage
as a multi-polygon of one part, and a stored one of one part opens as an area the field can change. A cleared location
goes as `null`; an area with holes or several parts is shown read-only and sent back as it is. DHIS2's errors about the
geometry are shown on the field. The maps load OpenStreetMap's tiles, which tell OpenStreetMap the area being looked at; `mapTiles` gives a tile
server of your own, or `null` for no background.

A data element of value type `COORDINATE` is a point on `LocationInput` too, said against the same org unit and stored
as `[lng,lat]`. It takes the rules, required marks, messages and read-only states as every other field does, and text
that is not a coordinate holds back Save as an invalid value would.

`EventFormNotes` lists the event's notes, oldest first, with who wrote each and when, and a box for one more. The note
goes with the next Save or Complete, under an id made for it, makes the form dirty, and is listed once DHIS2 has saved
it; the notes listed are never changed or sent back. A read-only form lists them without the box.

A completed event offers `Reopen` to a user who holds `F_UNCOMPLETE_EVENT` (or `ALL`) and may enter data in the stage,
as the Capture app does; DHIS2 refuses anyone else (`E1083`). On a stage that blocks entry it is the one action, with
`This event is completed and locked`; elsewhere it sits with Save. It sends the event as DHIS2 holds it, as active,
never what was typed since or what the rules changed, which stays in the form unsaved. It saves as Save does, then the
form is an active event, `onSaved` gets `ACTIVE`, and `Reopened` is announced. The user's authorities load with the
stage.

DHIS2's refusals of the program (`E1091`), of the org unit for the program (`E1029`) and of the org unit (`E1000`) read
as plain sentences with the program's and org unit's names (`Ngelehun CHC is not set up for Child Programme. (E1029)`),
else DHIS2's own text.

Parts: `EventFormFields` (the form's status, the event date, the categories, the location and the sections), `EventFormFeedback` (what the rules say
of the whole form), `EventFormNotes` (the notes) and `EventFormActions` (what to fix, Save, Complete and Reopen). Without children
the form shows all four, in that order; place them yourself to put something between them, or leave one out.

See `/blocks/event-form` in the docs for a live example, and `/playground/event-form` for a lab with every rule effect,
each value type and DHIS2 refusing a save.

`onUnsavedRuleChanges(count)` is called when the number of answers the rules alone changed since DHIS2 last saved the
event changes, such as a stored dose a rule now sets otherwise or a stored answer a rule now hides: 0 once there are
none, or once the user changes anything. It never makes the form dirty.

The rules run again on the values they set or clear until the answers settle, at most 4 times, so a rule reading a
field another rule set sees the new value however long the chain. Rules that hide or set each other's fields stop at 4
runs, with a warning in development. A commit to an answer no rule reads runs no rule, and the next runs start from the
values the last ones settled on, so a commit that leaves a chain as it was confirms it in one run (`settleRules` in
`program-rules`, whose `overlay`, `explain` and `outsideReads` the form also uses).
