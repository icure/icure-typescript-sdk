import { Identifier } from './Identifier'

/**
 * The party asserting that the patient has the healthcare element this asserter is attached to.
 *
 * This is the FHIR-style asserter concept: it does not say who recorded or authored the healthcare element, it says on
 * whose word the healthcare element is held to be true. A patient may self-report an allergy, a family member may
 * report a condition on behalf of the patient, and a physician may assert a diagnosis: all three are asserters, and the
 * same healthcare element may carry more than one of them.
 *
 * The party is named in exactly one of two ways, and exactly one of the two fields must be set:
 * - `localAsserterIdentifier` names a party stored in this iCure instance: an id, plus the `AsserterTypeEnum` saying
 *   which kind of record that id points at;
 * - `externalAsserterIdentifier` names a party that has no record here, through a business `Identifier` issued by
 *   another system. There is deliberately no asserter type on this branch: the kind of a record we do not store is not
 *   knowable to us.
 *
 * Both fields of `LocalAsserterIdentifier` are required by the server and by the other iCure SDKs, and are declared
 * optional here only because every model in this layer is. An asserter written with a partial local identifier cannot
 * be read back by those SDKs.
 *
 * Do not rely on the server to enforce any of the above. `asserters` is encrypted by default (see
 * `EncryptedFieldsConfig.Defaults.healthElement`), so the server usually sees only ciphertext and its own checks - the
 * exactly-one rule, id not blank - never run. They do run for a client that overrides `encryptedFieldsConfig` for
 * health elements without keeping `asserters` in the list, and a violation then surfaces as a `400`. The pairing inside
 * `LocalAsserterIdentifier` is never checked anywhere: `AsserterTypeEnum` bounds the vocabulary, not what the id
 * actually points at. All of these invariants are the caller's responsibility.
 *
 * Note on organisations: an organisation (hospital, practice, care home, ...) is not a distinct asserter type.
 * Organisations are stored as healthcare party records, distinguished from individual practitioners by tags set by the
 * client, so an organisation asserter is a `localAsserterIdentifier` with `type = 'healthcareParty'` whose `id` points
 * to such a record. The association between a practitioner and the organisation they were acting for at the time of
 * the assertion is deliberately not modelled here.
 */
export class HealthElementAsserter {
  constructor(json: JSON | any) {
    Object.assign(this as HealthElementAsserter, json)
  }

  /**
   * The asserting party, as a reference to a record stored in this instance. Unset when the party is named by
   * externalAsserterIdentifier.
   */
  localAsserterIdentifier?: HealthElementAsserter.LocalAsserterIdentifier
  /**
   * The asserting party, as a business identifier from a system that is not this one. Unset when the party is named by
   * localAsserterIdentifier. Carries no asserter type.
   */
  externalAsserterIdentifier?: Identifier
}

export namespace HealthElementAsserter {
  /**
   * A reference to the record, stored in iCure.
   */
  export class LocalAsserterIdentifier {
    constructor(json: JSON | any) {
      Object.assign(this as LocalAsserterIdentifier, json)
    }

    /**
     * The id of the entity making the assertion. Which entity it refers to is given by type.
     */
    id?: string
    /**
     * The kind of entity id refers to. This is the entity-kind axis, not the role the party played in the assertion.
     */
    type?: AsserterTypeEnum
  }

  /**
   * The kind of entity a LocalAsserterIdentifier id refers to.
   *
   * There is no entry for an organisation: organisations are stored as healthcare party records, so they use
   * `healthcareParty` (see the note on the class).
   */
  export type AsserterTypeEnum = 'patient' | 'healthcareParty' | 'relatedPerson'
  export const AsserterTypeEnum = {
    Patient: 'patient' as AsserterTypeEnum,
    HealthcareParty: 'healthcareParty' as AsserterTypeEnum,
    RelatedPerson: 'relatedPerson' as AsserterTypeEnum,
  }
}
