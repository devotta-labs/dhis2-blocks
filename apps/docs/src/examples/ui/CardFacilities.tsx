import { Button } from '@/components/dhis2/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/dhis2/ui/card'

const facilities = [
    { name: 'Ngelehun CHC', report: '2 Nov 2026', due: 14 },
    { name: 'Bumpe CHC', report: '28 Oct 2026', due: 6 },
]

/** One card per facility: a title, a short summary and an action. */
const CardFacilities = () => (
    <div className="grid gap-4 sm:grid-cols-2">
        {facilities.map((facility) => (
            <Card key={facility.name}>
                <CardHeader>
                    <CardTitle>{facility.name}</CardTitle>
                    <CardDescription>
                        Last report {facility.report}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                    {facility.due} people due for a visit this week
                </CardContent>
                <CardFooter>
                    <Button variant="outline" size="sm">
                        Open list
                    </Button>
                </CardFooter>
            </Card>
        ))}
    </div>
)

export default CardFacilities
