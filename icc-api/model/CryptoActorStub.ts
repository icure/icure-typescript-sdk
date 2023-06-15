import { DataOwnerTypeEnum } from './DataOwnerTypeEnum'
import { DataOwnerWithType } from './DataOwnerWithType'
import { Patient } from './Patient'
import { HealthcareParty } from './HealthcareParty'
import { Device } from './Device'
import {CodeStub} from "./CodeStub"

export class CryptoActorStub {
  constructor(json: JSON | any) {
    Object.assign(this as CryptoActorStub, json)
  }

  static fromDataOwner(dataOwnerWithType: Patient | HealthcareParty | Device) {
    return new CryptoActorStub({
      id: dataOwnerWithType.id,
      rev: dataOwnerWithType.rev,
      hcPartyKeys: dataOwnerWithType.hcPartyKeys,
      aesExchangeKeys: dataOwnerWithType.aesExchangeKeys,
      transferKeys: dataOwnerWithType.transferKeys,
      privateKeyShamirPartitions: dataOwnerWithType.privateKeyShamirPartitions,
      publicKeysForOaepWithSha256: dataOwnerWithType.publicKeysForOaepWithSha256,
      publicKey: dataOwnerWithType.publicKey,
      tags: dataOwnerWithType.tags,
    })
  }

  readonly id!: string
  readonly rev?: string
  /**
   * For each couple of HcParties (delegator and delegate), this map contains the exchange AES key. The delegator is always this hcp, the key of the map is the id of the delegate.The AES exchange key is encrypted using RSA twice : once using this hcp public key (index 0 in the Array) and once using the other hcp public key (index 1 in the Array). For a pair of HcParties. Each HcParty always has one AES exchange key for himself.
   */
  hcPartyKeys?: { [key: string]: Array<string> }
  /**
   * Extra AES exchange keys, usually the ones we lost access to at some point. The structure is { publicKey: { delegateId: { myPubKey1: aesExKey_for_this, delegatePubKey1: aesExKey_for_delegate } } }
   */
  aesExchangeKeys?: { [key: string]: { [key: string]: { [key: string]: string } } }
  /**
   * Our private keys encrypted with our public keys. The structure is { publicKey1: { publicKey2: privateKey2_encrypted_with_publicKey1, publicKey3: privateKey3_encrypted_with_publicKey1 } }
   */
  transferKeys?: { [key: string]: { [key: string]: string } }
  /**
   * The privateKeyShamirPartitions are used to share this hcp's private RSA key with a series of other hcParties using Shamir's algorithm. The key of the map is the hcp Id with whom this partition has been shared. The value is \"threshold⎮partition in hex\" encrypted using the the partition's holder's public RSA key
   */
  privateKeyShamirPartitions?: { [key: string]: string }
  /**
   * The public keys of this actor which should be used for RSA-OAEP with sha256 encryption.
   */
  publicKeysForOaepWithSha256?: string[]
  /**
   * The public key of this hcp
   */
  publicKey?: string
  /**
   * A tag is an item from a codification system that qualifies an entity as being member of a certain class, whatever the value it might have taken. If the tag qualifies the content of a field, it means that whatever the content of the field, the tag will always apply. For example, the label of a field is qualified using a tag. LOINC is a codification system typically used for tags.
   */
  tags?: Array<CodeStub>
}
export class CryptoActorStubWithType {
  constructor(json: JSON | any) {
    this.stub = new CryptoActorStub(json.stub)
    this.type = json.type as DataOwnerTypeEnum
  }

  static fromDataOwner(dataOwnerWithType: DataOwnerWithType) {
    return new CryptoActorStubWithType({
      stub: CryptoActorStub.fromDataOwner(dataOwnerWithType.dataOwner),
      type: dataOwnerWithType.type,
    })
  }

  stub: CryptoActorStub
  type: DataOwnerTypeEnum
}
