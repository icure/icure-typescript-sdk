import { EntityShareOrMetadataUpdateRequest } from './EntityShareOrMetadataUpdateRequest'

export type BulkShareOrUpdateMetadataParams = {
  requestsByEntityId: { [entityId: string]: EntityRequestInformation }
}
export type EntityRequestInformation = {
  requests: { [requestId: string]: EntityShareOrMetadataUpdateRequest }
  potentialParentDelegations: string[]
}
