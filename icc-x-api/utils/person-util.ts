import * as models from '../../icc-api/model/models'

export function hasName(person: models.Patient | models.HealthcareParty, nameUse: models.PersonName.UseEnum) {
  return person.names?.some((n) => n.use === nameUse)
}

export function findName(person: models.Patient | models.HealthcareParty, nameUse: models.PersonName.UseEnum): models.PersonName | undefined {
  return person.names?.find((n) => n.use === nameUse)
}

export function garnishPersonWithName<P extends models.Patient | models.HealthcareParty>(
  person: P,
  nameUse: models.PersonName.UseEnum,
  lastName?: string,
  firstName?: string,
  fullName: string = `${lastName} ${firstName ?? ''}`
): P {
  return {
    ...person,
    names: (person.names ?? []).concat([
      new models.PersonName({
        lastName: lastName,
        firstNames: firstName ? [firstName] : [],
        text: fullName,
        use: nameUse,
      }),
    ]),
  }
}
