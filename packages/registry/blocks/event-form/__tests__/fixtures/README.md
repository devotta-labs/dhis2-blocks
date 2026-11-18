# Event form fixtures

`refusals-2.42.json` holds error reports DHIS2 2.42.6 (Sierra Leone demo, `pnpm docs:up`) answered on 2026-11-16 to
tracker imports sent as the form sends them (`/api/tracker?async=false&importStrategy=CREATE_AND_UPDATE&atomicMode=ALL`),
one per error code, trimmed to the error report. They were provoked by:

| Code    | What was sent                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `E1302` | `abc` for the INTEGER `qrur9Dvnyt5` (Inpatient morbidity and mortality); DHIS2 names the value type, not the data element                  |
| `E1125` | `Nope` for the option set field `oZg33kd9taw`                                                                                              |
| `E1303` | no `msodh3rEMJa`, compulsory in a stage validated on update and insert                                                                     |
| `E1055` | no `attributeCategoryOptions` for a program with the Implementing Partner and Projects combination                                         |
| `E1116` | an option id that does not exist                                                                                                           |
| `E1117` | an option of another category (`qkPbeWaFsnU`, Fixed)                                                                                       |
| `E1056` | `i4Nbp8S2G6A` (starts 2016-04-01) on an event of 2016-01-15; DHIS2 names the option, not its id                                            |
| `E1057` | `OUUdG3sdOqb` (ended 2016-10-01) on an event of today, in a test program made for the check                                                |
| `E1099` | an option shared without data write, by a user made for the check (`EfLiveUser1`)                                                          |
| `E1000` | an org unit outside that user's capture org units                                                                                          |
| `E1012` | a Point on a stage whose feature type is NONE                                                                                              |
| `E1326` | an update of a completed event of a stage that blocks the entry form after completion                                                      |
| `E1083` | that event sent back as `ACTIVE` by a user with data write but without `F_UNCOMPLETE_EVENT`; the same on a stage that does not block entry |
| `E1091` | an event of Malaria testing and surveillance (`bMcwwoVnbSR`) by a user without data write access to it                                     |
| `E1029` | an event of Inpatient morbidity and mortality at Sierra Leone (`ImspTQPwCqd`), an org unit not assigned to the program                     |

With `F_UNCOMPLETE_EVENT` added (or `ALL`), the same user's `ACTIVE` import of the completed event, with no data
values, reopened it with its values kept. A user without it may still update a completed event of a stage that does
not block entry, as long as it stays `COMPLETED`.

The same server read `attributeCategoryOptions` back comma-separated (`C6nZpLKjEJr,yMj2MnmNI8L`) and refused them
`;`-separated, as one unknown option (`E1116`).
