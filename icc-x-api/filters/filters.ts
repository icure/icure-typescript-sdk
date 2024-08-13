import { ConstantFilter } from './ConstantFilter'
import { Patient } from '../../icc-api/model/Patient'
import { AbstractFilterPatient } from '../../icc-api/model/AbstractFilterPatient'
import { AbstractFilterContact } from '../../icc-api/model/AbstractFilterContact'
import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'
import { Service } from '../../icc-api/model/Service'
import { Contact } from '../../icc-api/model/Contact'
import { IntersectionFilter } from './IntersectionFilter'
import { UnionFilter } from './UnionFilter'
import { ComplementFilter } from './ComplementFilter'
import { PatientByHcPartyAndActiveFilter } from './PatientByHcPartyAndActiveFilter'
import { PatientByHcPartyAndAddressFilter } from './PatientByHcPartyAndAddressFilter'
import { PatientByHcPartyAndExternalIdFilter } from './PatientByHcPartyAndExternalIdFilter'
import { PatientByHcPartyAndSsinsFilter } from './PatientByHcPartyAndSsinsFilter'
import { PatientByHcPartyDateOfBirthBetweenFilter } from './PatientByHcPartyDateOfBirthBetweenFilter'
import { PatientByHcPartyDateOfBirthFilter } from './PatientByHcPartyDateOfBirthFilter'

import { add, format } from 'date-fns'
import { PatientByHcPartyFilter } from './PatientByHcPartyFilter'
import { PatientByHcPartyGenderEducationProfessionFilter } from './PatientByHcPartyGenderEducationProfessionFilter'
import { PatientByIdsFilter } from './PatientByIdsFilter'
import { PatientByHcPartyNameContainsFuzzyFilter } from './PatientByHcPartyNameContainsFuzzyFilter'
import { ContactByHcPartyFilter } from './ContactByHcPartyFilter'
import { Device } from '../../icc-api/model/Device'
import { AbstractFilterDevice } from '../../icc-api/model/AbstractFilterDevice'
import { MaintenanceTask } from '../../icc-api/model/MaintenanceTask'
import { AbstractFilterMaintenanceTask } from '../../icc-api/model/AbstractFilterMaintenanceTask'
import { Code } from '../../icc-api/model/Code'
import { AbstractFilterCode } from '../../icc-api/model/AbstractFilterCode'
import { HealthElement } from '../../icc-api/model/HealthElement'
import { AbstractFilterHealthElement } from '../../icc-api/model/AbstractFilterHealthElement'
import { Invoice } from '../../icc-api/model/Invoice'
import { AbstractFilterInvoice } from '../../icc-api/model/AbstractFilterInvoice'
import { User } from '../../icc-api/model/User'
import { AbstractFilterUser } from '../../icc-api/model/AbstractFilterUser'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { AbstractFilterHealthcareParty } from '../../icc-api/model/AbstractFilterHealthcareParty'
import { CalendarItem } from '../../icc-api/model/CalendarItem'
import { AbstractFilterCalendarItem } from '../../icc-api/model/AbstractFilterCalendarItem'
import GenderEnum = Patient.GenderEnum

export * from './AllCodesFilter'
export * from './AllDevicesFilter'
export * from './AllHealthcarePartiesFilter'
export * from './AllUsersFilter'
export * from './CalendarItemByDataOwnerPatientStartTimeFilter'
export * from './CalendarItemByRecurrenceIdFilter'
export * from './CalendarItemByPeriodAndDataOwnerIdFilter'
export * from './CalendarItemByPeriodAndAgendaIdFilter'
export * from './CodeByIdsFilter'
export * from './CodeByRegionTypeLabelLanguageFilter'
export * from './ComplementFilter'
export * from './ConstantFilter'
export * from './ContactByHcPartyFilter'
export * from './ContactByHcPartyPatientTagCodeDateFilter'
export * from './ContactByHcPartyTagCodeDateFilter'
export * from './ContactByServiceIdsFilter'
export * from './DeviceByHcPartyFilter'
export * from './DeviceByIdsFilter'
export * from './HealthElementByHcPartyFilter'
export * from './HealthElementByHcPartyIdentifiersFilter'
export * from './HealthElementByHcPartySecretForeignKeysFilter'
export * from './HealthElementByHcPartyTagCodeFilter'
export * from './HealthElementByIdsFilter'
export * from './HealthcarePartyByIdsFilter'
export * from './HealthcarePartyByNameFilter'
export * from './HealthcarePartyByTagCodeFilter'
export * from './IntersectionFilter'
export * from './InvoiceByHcPartyCodeDateFilter'
export * from './PatientByHcPartyAndActiveFilter'
export * from './PatientByHcPartyAndAddressFilter'
export * from './PatientByHcPartyAndExternalIdFilter'
export * from './PatientByHcPartyAndIdentifiersFilter'
export * from './PatientByHcPartyAndSsinFilter'
export * from './PatientByHcPartyAndSsinsFilter'
export * from './PatientByHcPartyDateOfBirthBetweenFilter'
export * from './PatientByHcPartyDateOfBirthFilter'
export * from './PatientByHcPartyFilter'
export * from './PatientByHcPartyGenderEducationProfessionFilter'
export * from './PatientByHcPartyNameContainsFuzzyFilter'
export * from './PatientByHcPartyNameFilter'
export * from './PatientByIdsFilter'
export * from './ServiceByContactsAndSubcontactsFilter'
export * from './ServiceByHcPartyFilter'
export * from './ServiceByHcPartyIdentifiersFilter'
export * from './ServiceByHcPartyHealthElementIdsFilter'
export * from './ServiceByHcPartyTagCodeDateFilter'
export * from './ServiceByIdsFilter'
export * from './ServiceBySecretForeignKeys'
export * from './UnionFilter'
export * from './UserByIdsFilter'
export * from './MaintenanceTaskByHcPartyAndIdentifiersFilter'
export * from './MaintenanceTaskByHcPartyAndTypeFilter'
export * from './MaintenanceTaskByIdsFilter'
export * from './MaintenanceTaskAfterDateFilter'
export * from './TopicByHcPartyFilter'
export * from './TopicByParticipantFilter'
export * from './MessageByHcPartyFilter'
export * from './MessageByHcPartyTransportGuidFilter'
export * from './LatestMessageByHcPartyTransportGuidFilter'

export class Filter {
  public static patient(): PatientFilterBuilder {
    return new PatientFilterBuilder()
  }
}

export type AbstractFilter<T> =
  | (T extends Patient
      ? AbstractFilterPatient
      : T extends Contact
      ? AbstractFilterContact
      : T extends Service
      ? AbstractFilterService
      : T extends HealthcareParty
      ? AbstractFilterHealthcareParty
      : T extends Device
      ? AbstractFilterDevice
      : T extends MaintenanceTask
      ? AbstractFilterMaintenanceTask
      : T extends Code
      ? AbstractFilterCode
      : T extends HealthElement
      ? AbstractFilterHealthElement
      : T extends Invoice
      ? AbstractFilterInvoice
      : T extends User
      ? AbstractFilterUser
      : T extends CalendarItem
      ? AbstractFilterCalendarItem
      : never)
  | ConstantFilter<T>
  | IntersectionFilter<T>
  | UnionFilter<T>
  | ComplementFilter<T>

const f: AbstractFilterContact = new ComplementFilter<Contact>(new ContactByHcPartyFilter({}), new ContactByHcPartyFilter({}))

abstract class FilterBuilder<T> {
  // This is the current generator for the filter, when we call build(), filterProvider() is going to be called
  filterProvider?: () => AbstractFilter<T>
  // This is the method that is called each time we chain a filter to another filter. The default behaviour is to
  // return a FilterBuilder with the provider set to the last element in the chain, except when we use combination
  // operators like or()/and()/… . After one of those, the composer is set to a function that will return a FilterBuilder

  protected constructor(
    filterProvider?: () => AbstractFilter<T>,
    composer?: (thisFilterBuilder: FilterBuilder<T>, otherFilterBuilder: FilterBuilder<T>) => FilterBuilder<T>
  ) {
    this.filterProvider = filterProvider
    composer && (this.composer = composer)
  }

  // that combines the existing filterBuilder with the filter definition we just added.
  composer: (thisFilterBuilder: FilterBuilder<T>, otherFilterBuilder: FilterBuilder<T>) => FilterBuilder<T> = (
    thisFilterBuilder: FilterBuilder<T>,
    otherFilterBuilder: FilterBuilder<T>
  ) => otherFilterBuilder

  abstract build(): AbstractFilter<T>

  abstract clone(
    filterProvider?: () => AbstractFilter<T>,
    composer?: (thisFilterBuilder: FilterBuilder<T>, otherFilterBuilder: FilterBuilder<T>) => FilterBuilder<T>
  ): FilterBuilder<T>

  listOf(elements: T[]): FilterBuilder<T> {
    return this.clone(() => new ConstantFilter<T>(elements) as AbstractFilter<T>)
  }

  /**
   * There are two ways of doing and, or, …
   *
   * 1) for (...) or (...) we use the syntax ... .or((builder) => builder...)
   * ex: youngerThan(65).or((b) => b.olderThan(18).and().gender(M)) means any gender < 65 or male > 18
   * 2) for ((...) or ...) we use the syntax ... .or().…
   * ex: youngerThan(65).or().olderThan(18).and().gender(M) means males between 18 and 65
   *
   * When 1) is used we do not have to wait for anything to provide a resolved builder that can later be combined with extra elements in the chain.
   * In other words, we can build the current filter chain up to the or/and/… and we can build what is inside the or/and/… brackets and we can set
   * the filterProvider of the returned Builder to () => UnionFilter([leftHand.build(), innerBrackets.build()]).
   *
   * When 2) is used, things get more tricky because we will have to do an or/and/… between what we have on the leftHand and with what we do not have
   * yet on the right hand. What we do in that situation is to set the filterProvider() to undefined because calling build() without having provided a
   * rightHand doesn't make sense. We set a composer that is going to be called the next time we chain a filter.
   *
   * @param filterBuilderFactory
   */

  and(filterBuilderFactory?: (it: FilterBuilder<T>) => FilterBuilder<T>): FilterBuilder<T> {
    const combiner = (leftHandFilter: AbstractFilter<T>, rightHandFilter: AbstractFilter<T>) => () =>
      new IntersectionFilter<T>([leftHandFilter, rightHandFilter]) as AbstractFilter<T>

    return filterBuilderFactory ? this.makeEagerLeftRightFilterBuilder(filterBuilderFactory, combiner) : this.makeLazyLeftRightFilterBuilder(combiner)
  }

  or(filterBuilderFactory?: (it: FilterBuilder<T>) => FilterBuilder<T>): FilterBuilder<T> {
    const combiner = (leftHandFilter: AbstractFilter<T>, rightHandFilter: AbstractFilter<T>) => () =>
      new UnionFilter<T>([leftHandFilter, rightHandFilter]) as AbstractFilter<T>

    return filterBuilderFactory ? this.makeEagerLeftRightFilterBuilder(filterBuilderFactory, combiner) : this.makeLazyLeftRightFilterBuilder(combiner)
  }

  minus(filterBuilderFactory?: (it: FilterBuilder<T>) => FilterBuilder<T>): FilterBuilder<T> {
    const combiner = (leftHandFilter: AbstractFilter<T>, rightHandFilter: AbstractFilter<T>) => () =>
      new ComplementFilter<T>(leftHandFilter, rightHandFilter) as AbstractFilter<T>

    return filterBuilderFactory ? this.makeEagerLeftRightFilterBuilder(filterBuilderFactory, combiner) : this.makeLazyLeftRightFilterBuilder(combiner)
  }

  private makeLazyLeftRightFilterBuilder(
    leftHandRightHandFiltersCombiner: (leftHandFilter: AbstractFilter<T>, rightHandFilter: AbstractFilter<T>) => () => AbstractFilter<T>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const leftHandFilterBuilder: FilterBuilder<T> = this
    const leftHandFilter = leftHandFilterBuilder.build() // Freeze the leftHand filter

    return leftHandFilterBuilder.filterProvider
      ? this.clone(
          undefined, //filter provider is indeterminate until we have performed a composition
          (unused: FilterBuilder<T>, rightHandFilterBuilder: FilterBuilder<T>) => {
            // because we freeze the leftHand in the state it is right now, we are not going to use its value when the composition occurs
            const rightHandFilter = rightHandFilterBuilder.build()

            return rightHandFilter
              ? this.clone(leftHandRightHandFiltersCombiner(leftHandFilter, rightHandFilter), rightHandFilterBuilder.composer)
              : rightHandFilterBuilder //Can this happen ?
          }
        )
      : this
  }

  private makeEagerLeftRightFilterBuilder(
    rightHandFilterBuilderFactory: (it: FilterBuilder<T>) => FilterBuilder<T>,
    leftHandRightHandFiltersCombiner: (leftHandFilter: AbstractFilter<T>, rightHandFilter: AbstractFilter<T>) => () => AbstractFilter<T>
  ) {
    const rightHandFilterBuilder = rightHandFilterBuilderFactory(this)
    return this.filterProvider ? this.clone(leftHandRightHandFiltersCombiner(this.build(), rightHandFilterBuilder.build())) : this
  }
}

class PatientFilterBuilder extends FilterBuilder<Patient> {
  hcpId?: string

  constructor(
    filterProvider?: () => AbstractFilter<Patient>,
    hcpId?: string,
    composer?: (thisFilterBuilder: FilterBuilder<Patient>, otherFilterBuilder: FilterBuilder<Patient>) => FilterBuilder<Patient>
  ) {
    super(filterProvider, composer)
    this.hcpId = hcpId
  }

  clone(
    filterProvider?: () => AbstractFilter<Patient>,
    composer?: (thisFilterBuilder: FilterBuilder<Patient>, otherFilterBuilder: FilterBuilder<Patient>) => FilterBuilder<Patient>
  ): FilterBuilder<Patient> {
    return new PatientFilterBuilder(filterProvider, this.hcpId, composer)
  }

  listOf(elements: Patient[]): PatientFilterBuilder {
    return new PatientFilterBuilder(() => new ConstantFilter<Patient>(elements) as AbstractFilter<Patient>)
  }

  and(filterBuilderFactory?: (it: PatientFilterBuilder) => PatientFilterBuilder): PatientFilterBuilder {
    return super.and(filterBuilderFactory as any) as PatientFilterBuilder
  }

  or(filterBuilderFactory?: (it: PatientFilterBuilder) => PatientFilterBuilder): PatientFilterBuilder {
    return super.or(filterBuilderFactory as any) as PatientFilterBuilder
  }

  minus(filterBuilderFactory?: (it: PatientFilterBuilder) => PatientFilterBuilder): PatientFilterBuilder {
    return super.minus(filterBuilderFactory as any) as PatientFilterBuilder
  }

  forHcp(hcpId: string): PatientFilterBuilder {
    return this.composer(this, new PatientFilterBuilder(this.filterProvider, hcpId)) as PatientFilterBuilder
  }

  all(): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(() => new PatientByHcPartyFilter({ healthcarePartyId: this.hcpId }), this.hcpId)
    ) as PatientFilterBuilder
  }

  activePatients(): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(() => new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: true }), this.hcpId)
    ) as PatientFilterBuilder
  }

  inactivePatients(): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(() => new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: false }), this.hcpId)
    ) as PatientFilterBuilder
  }

  byAddress(searchString?: string, postalCode?: string, houseNumber?: string): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () =>
          new PatientByHcPartyAndAddressFilter({
            healthcarePartyId: this.hcpId,
            searchString,
            postalCode,
            houseNumber,
          }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  withExternalId(externalId: string): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () =>
          new PatientByHcPartyAndExternalIdFilter({
            healthcarePartyId: this.hcpId,
            externalId: externalId,
          }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  withSsins(ssins: string[]): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(() => new PatientByHcPartyAndSsinsFilter({ healthcarePartyId: this.hcpId, ssins: ssins }), this.hcpId)
    ) as PatientFilterBuilder
  }

  withDateOfBirthBetween(from?: number, to?: number): PatientFilterBuilder {
    return this.composer(
      this,
      this.clone(
        () =>
          new PatientByHcPartyDateOfBirthBetweenFilter({
            healthcarePartyId: this.hcpId,
            minDateOfBirth: from,
            maxDateOfBirth: to,
          })
      )
    ) as PatientFilterBuilder
  }

  byDateOfBirth(dateOfBirth: number): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () =>
          new PatientByHcPartyDateOfBirthFilter({
            healthcarePartyId: this.hcpId,
            dateOfBirth: dateOfBirth,
          }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  olderThan(age: number): PatientFilterBuilder {
    return this.withDateOfBirthBetween(10000101, parseInt(format(add(new Date(), { years: -age }), 'yyyyMMdd')))
  }

  youngerThan(age: number): PatientFilterBuilder {
    return this.withDateOfBirthBetween(parseInt(format(add(new Date(), { years: -age }), 'yyyyMMdd')), 99991231)
  }

  byGenderEducationProfession(gender?: GenderEnum, education?: string, profession?: string): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () =>
          new PatientByHcPartyGenderEducationProfessionFilter({
            healthcarePartyId: this.hcpId,
            gender: gender,
            education: education,
            profession: profession,
          }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  byIds(ids: string[]): PatientFilterBuilder {
    return this.composer(this, new PatientFilterBuilder(() => new PatientByIdsFilter({ ids: ids }), this.hcpId)) as PatientFilterBuilder
  }

  searchByName(name: string): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () =>
          new PatientByHcPartyNameContainsFuzzyFilter({
            healthcarePartyId: this.hcpId,
            searchString: name,
          }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  build(): AbstractFilter<Patient> {
    return this.filterProvider?.() || this.all().build()
  }
}
