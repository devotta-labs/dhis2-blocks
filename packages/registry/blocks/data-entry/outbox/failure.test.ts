import { classify } from './failure'

test.each([
    [
        'Request Entity Too Large (413)',
        {
            kind: 'refusal',
            reason: 'An unknown error occurred - Request Entity Too Large (413)',
        },
    ],
    ['Bad Gateway (502)', { kind: 'retry' }],
])(
    'an error page without JSON is judged by the status at the end of its message: %s',
    (status, failure) => {
        expect(
            classify({
                type: 'unknown',
                message: `An unknown error occurred - ${status}`,
                details: {},
            })
        ).toEqual(failure)
    }
)
