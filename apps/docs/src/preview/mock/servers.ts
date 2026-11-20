import type { LabNetwork } from '../../playground/network'
import type { RequestType } from './aliasIds'

type Respond = (request: never, type: RequestType) => object | Promise<object>

/** A fake DHIS2 for one example: the playground's server for its block, answering in the example's ids. */
export interface MockServer {
    resources: readonly string[]
    respond: Respond
    apiVersion?: number
    systemInfo?: { calendar?: string; version?: string }
}

/** Fast enough that a page of examples never waits, slow enough that loading states show. */
export const MOCK_NETWORK: LabNetwork = { delay: 40, endpoints: {} }
