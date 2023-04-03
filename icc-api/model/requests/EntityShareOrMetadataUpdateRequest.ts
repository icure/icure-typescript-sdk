import { EntityShareRequest } from './EntityShareRequest'
import { EntitySharedMetadataUpdateRequest } from './EntitySharedMetadataUpdateRequest'

export class EntityShareOrMetadataUpdateRequest {
  constructor(params: { share?: EntityShareRequest; update?: EntitySharedMetadataUpdateRequest }) {
    if (params.share && !params.update) {
      this.share = params.share
    } else if (!params.share && params.update) {
      this.update = params.update
    } else throw new Error('Exactly one of share or update should be set')
  }

  share?: EntityShareRequest
  update?: EntitySharedMetadataUpdateRequest
}
