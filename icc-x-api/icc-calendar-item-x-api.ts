import { IccCryptoXApi } from "../icc-x-api/icc-crypto-x-api";

import * as i18n from "./rsrc/contact.i18n";

import * as _ from 'lodash';
import {iccCalendarItemApi} from "@medispring/icure-api/src/lib/icc-api/api/ICCCalendarItemApi";

export class IccCalendarItemXApi extends iccCalendarItemApi {

	i18n: any = i18n;
	crypto: IccCryptoXApi;

	constructor(host, headers, crypto) {
		super(host, headers);
		this.crypto = crypto;
	}

	// newInstance(user, patient, c) {
	// 	const calendarItem = _.extend({
	// 		id: this.crypto.randomUuid(),
	// 		_type: 'org.taktik.icure.entities.CalendarItem',
	// 		created: new Date().getTime(),
	// 		modified: new Date().getTime(),
	// 		responsible: user.healthcarePartyId,
	// 		author: user.id,
	// 		codes: [],
	// 		tags: [],
	// 		groupId: this.crypto.randomUuid(),
	// 		subContacts: [],
	// 		services: [],
	// 		openingDate: parseInt(moment().format('YYYYMMDDHHmmss'))
	// 	}, c || {});
    //
	// 	return this.crypto.extractDelegationsSFKs(patient, user.healthcarePartyId).then(secretForeignKeys => this.crypto.initObjectDelegations(calendarItem, patient, user.healthcarePartyId, secretForeignKeys[0])).then(initData => {
	// 		_.extend(calendarItem, { delegations: initData.delegations, cryptedForeignKeys: initData.cryptedForeignKeys, secretForeignKeys: initData.secretForeignKeys });
    //
	// 		let promise = Promise.resolve(calendarItem);
	// 		(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(delegateId => promise = promise.then(contact => this.crypto.appendObjectDelegations(contact, patient, user.healthcarePartyId, delegateId, initData.secretId)).then(extraData => _.extend(calendarItem, { delegations: extraData.delegations, cryptedForeignKeys: extraData.cryptedForeignKeys })));
	// 		return promise;
	// 	});
	// }

  newInstance(user, ci) {
    const calendarItem = _.extend({
      id: this.crypto.randomUuid(),
      _type: 'org.taktik.icure.entities.CalendarItem',
      created: new Date().getTime(),
      modified: new Date().getTime(),
      responsible: user.healthcarePartyId,
      author: user.id,
      codes: [],
      tags: []
    }, ci || {});

    return this.crypto.initObjectDelegations(calendarItem, null, user.healthcarePartyId, null).then(initData => {
      _.extend(calendarItem, { delegations: initData.delegations });

      let promise = Promise.resolve(calendarItem);
      (user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(delegateId => promise = promise.then(patient => this.crypto.appendObjectDelegations(patient, null, user.healthcarePartyId, delegateId, initData.secretId)).then(extraData => _.extend(calendarItem, { delegations: extraData.delegations })));
      return promise;
    });
  }

	/**
  * 1. Check whether there is a delegation with 'hcpartyId' or not.
  * 2. 'fetchHcParty[hcpartyId][1]': is encrypted AES exchange key by RSA public key of him.
  * 3. Obtain the AES exchange key, by decrypting the previous step value with hcparty private key
  *      3.1.  KeyPair should be fetch from cache (in jwk)
  *      3.2.  if it doesn't exist in the cache, it has to be loaded from Browser Local store, and then import it to WebCrypto
  * 4. Obtain the array of delegations which are delegated to his ID (hcpartyId) in this patient
  * 5. Decrypt and collect all keys (secretForeignKeys) within delegations of previous step (with obtained AES key of step 4)
  * 6. Do the REST call to get all contacts with (allSecretForeignKeysDelimitedByComa, hcpartyId)
  *
  * After these painful steps, you have the contacts of the patient.
  *
  * @param hcparty
  * @param patient (Promise)
  */
	// findBy(hcpartyId, patient) {
	// 	return this.crypto.extractDelegationsSFKs(patient, hcpartyId)
	// 		.then(secretForeignKeys => this.findByHCPartyPatientSecretFKeys(hcpartyId, secretForeignKeys.join(',')))
	// 		.then(contacts => this.decrypt(hcpartyId, contacts))
	// 		.then(function (decryptedContacts) {
	// 			return decryptedContacts;
	// 		});
	// }
    //
	// decrypt(hcpartyId, ctcs) {
	// 	return Promise.all(ctcs.map(ctc => this.crypto.decryptAndImportAesHcPartyKeysInDelegations(hcpartyId, ctc.delegations).then(function (decryptedAndImportedAesHcPartyKeys) {
	// 		var collatedAesKeys = {};
	// 		decryptedAndImportedAesHcPartyKeys.forEach(k => collatedAesKeys[k.delegatorId] = k.key);
	// 		return this.crypto.decryptDelegationsSFKs(ctc.delegations[hcpartyId], collatedAesKeys, ctc.id).then(sfks => {
	// 			return Promise.all(ctc.services.map(svc => {
	// 				if (svc.encryptedContent || svc.encryptedSelf) {
	// 					return this.crypto.AES.importKey('raw', this.crypto.utils.hex2ua(sfks[0].replace(/-/g, ''))).then(key => svc.encryptedContent ? new Promise((resolve, reject) => this.crypto.AES.decrypt(key, this.crypto.utils.text2ua(atob(svc.encryptedContent))).then(c => resolve({ content: JSON.parse(this.crypto.utils.ua2utf8(c)) })).catch(err => {
	// 						console.log("Error, could not decrypt: " + err);resolve(null);
	// 					})) : svc.encryptedSelf ? new Promise((resolve, reject) => this.crypto.AES.decrypt(key, this.crypto.utils.text2ua(atob(svc.encryptedSelf))).then(s => resolve(JSON.parse(this.crypto.utils.ua2utf8(s)))).catch(err => {
	// 						console.log("Error, could not decrypt: " + err);resolve(null);
	// 					})) : null).then(decrypted => {
	// 						decrypted && _.assign(svc, decrypted);
	// 						return svc;
	// 					});
	// 				} else {
	// 					return Promise.resolve(svc);
	// 				}
	// 			})).then(svcs => {
	// 				ctc.services = svcs;
	// 				//console.log('ES:'+ctc.encryptedSelf)
	// 				return ctc.encryptedSelf ? this.crypto.AES.importKey('raw', this.crypto.utils.hex2ua(sfks[0].replace(/-/g, ''))).then(key => this.crypto.AES.decrypt(key, this.crypto.utils.text2ua(atob(ctc.encryptedSelf))).then(dec => {
	// 					dec && _.assign(ctc, JSON.parse(this.crypto.utils.ua2utf8(dec)));
	// 					return ctc;
	// 				})) : ctc;
	// 			}).catch(function (e) {
	// 				console.log(e);
	// 			});
	// 		});
	// 	}.bind(this)))).catch(function (e) {
	// 		console.log(e);
	// 	});
	// }
    //
	// contactOfService(ctcs, svcId) {
	// 	let latestContact = null;
	// 	let latestService = null;
	// 	ctcs.forEach(c => {
	// 		const s = c.services.find(it => svcId === it.id);
	// 		if (s && (!latestService || moment(s.valueDate).isAfter(moment(latestService.valueDate)))) {
	// 			latestContact = c;
	// 			latestService = s;
	// 		}
	// 	});
	// 	return latestContact;
	// }
    //
	// filteredServices(ctcs, filter) {
	// 	const byIds = {};
	// 	ctcs.forEach(c => (c.services || []).filter(s => filter(s, c)).forEach(s => {
	// 		const ps = byIds[s.id];
	// 		if (!ps || !ps.modified || s.modified && ps.modified < s.modified) {
	// 			byIds[s.id] = s;
	// 			s.contactId = c.id;
	// 		}
	// 	}));
	// 	return _.values(byIds).filter((s: any) => !s.deleted && !s.endOfLife);
	// }
    //
	// //Return a promise
	// filterServices(ctcs, filter) {
	// 	return Promise.resolve(this.filteredServices(ctcs, filter));
	// }
    //
	// services(ctc, label) {
	// 	return ctc.services.filter(s => s.label === label);
	// }
    //
	// preferredContent(svc, lng) {
	// 	return svc && svc.content && (svc.content[lng] || svc.content['fr'] || (Object.keys(svc.content)[0] ? svc.content[Object.keys(svc.content)[0]] : null));
	// }
    //
	// shortServiceDescription(svc, lng) {
	// 	const c = this.preferredContent(svc, lng);
	// 	return !c ? '' : c.stringValue || (c.numberValue || c.numberValue === 0) && c.numberValue || c.measureValue && '' + (c.measureValue.value || c.measureValue.value === 0 ? c.measureValue.value : '-') + (c.measureValue.unit ? ' ' + c.measureValue.unit : '') || c.booleanValue && svc.label || (c.medicationValue ? this.medication().medicationToString(c.medicationValue, lng) : null);
	// }
    //
	// medicationValue(svc, lng) {
	// 	const c = svc && svc.content && (svc.content[lng] || svc.content['fr'] || (Object.keys(svc.content)[0] ? svc.content[Object.keys(svc.content)[0]] : null));
	// 	return c && c.medicationValue;
	// }
    //
	// contentHasData(c) {
	// 	return c.stringValue || c.numberValue || c.measureValue || c.booleanValue || c.booleanValue === false || c.medicationValue || c.documentId;
	// }
    //
	// localize(e, lng) {
	// 	if (!e) {
	// 		return null;
	// 	}
	// 	return e[lng] || e.fr || e.en || e.nl;
	// }
    //
	// promoteServiceInContact(ctc, user, ctcs, svc, formId, poaId, heId, init) {
	// 	if (!ctc) {
	// 		return null;
	// 	}
	// 	const existing = ctc.services.find(s => s.id === svc.id);
	// 	const promoted = _.extend(_.extend(existing || {}, svc), { author: user.id, responsible: user.healthcarePartyId, modified: new Date().getTime() });
	// 	if (!existing) {
	// 		(ctc.services || (ctc.services = [])).push(promoted);
	// 	}
    //
	// 	let sc = ctc.subContacts.find(sc => (formId === undefined || sc.formId === formId) && sc.planOfActionId === poaId && sc.healthElementId === heId);
	// 	if (!sc) {
	// 		const pastCtc = svc.contactId && ctcs.find(c => c.id === svc.ctcId);
	// 		sc = pastCtc && pastCtc.subContacts.find(sc => (formId === undefined || sc.formId === formId) && sc.planOfActionId === poaId && sc.healthElementId === heId);
    //
	// 		if (!sc) {
	// 			ctc.subContacts.push(sc = { formId: formId || null, planOfActionId: poaId, healthElementId: heId, services: [] });
	// 		}
	// 	}
	// 	const csc = ctc.subContacts.find(csc => csc.services.indexOf(svc.id) >= 0);
	// 	if (csc) {
	// 		if (csc !== sc) {
	// 			csc.splice(csc.services.indexOf(svc.id), 1);
	// 			sc.services.push({ serviceId: svc.id });
	// 		}
	// 	} else {
	// 		sc.services.push({ serviceId: svc.id });
	// 	}
    //
	// 	return init && init(svc) || svc;
	// }
    //
	// isNumeric(svc, lng) {
	// 	const c = this.preferredContent(svc, lng);
	// 	return c && (c.measureValue || c.numberValue || c.numberValue == 0);
	// }
    //
	// service() {
	// 	return {
	// 		newInstance: function (user, s) {
	// 			return _.extend({
	// 				id: this.crypto.randomUuid(),
	// 				_type: 'org.taktik.icure.entities.embed.Service',
	// 				created: new Date().getTime(),
	// 				modified: new Date().getTime(),
	// 				responsible: user.healthcarePartyId,
	// 				author: user.id,
	// 				codes: [],
	// 				tags: [],
	// 				content: {},
	// 				valueDate: parseInt(moment().format('YYYYMMDDhhmmss'))
	// 			}, s);
	// 		}.bind(this)
	// 	};
	// }
    //
	// medication() {
	// 	const self = {
	// 		'regimenScores': {
	// 			'beforebreakfast': 70000,
	// 			'duringbreakfast': 80000,
	// 			'afterbreakfast': 90000,
	// 			'morning': 100000,
	// 			'betweenbreakfastandlunch': 103000,
	// 			'beforelunch': 113000,
	// 			'duringlunch': 123000,
	// 			'afterlunch': 130000,
	// 			'afternoon': 140000,
	// 			'betweenlunchanddinner': 160000,
	// 			'beforedinner': 180000,
	// 			'duringdinner': 190000,
	// 			'afterdinner': 200000,
	// 			'evening': 210000,
	// 			'betweendinnerandsleep': 213000,
	// 			'thehourofsleep': 220000,
	// 			'night': 230000,
	// 			'betweenmeals': 10000,
	// 			'aftermeal': 20000
	// 		},
	// 		'medicationNameToString': function (m, lang) {
	// 			return m.compoundPrescription ? m.compoundPrescription : m.substanceProduct ? self.productToString(m.substanceProduct, lang) : self.productToString(m.medicinalProduct, lang);
	// 		},
	// 		'medicationToString': function (m, lang) {
	// 			let res = `${self.medicationNameToString(m, lang)}, ${self.posologyToString(m, lang)}`;
	// 			res = m.numberOfPackages ? `${m.numberOfPackages} ${m.numberOfPackages > 1 ? this.i18n[lang].packagesOf : this.i18n[lang].packageOf} ${res}` : res;
	// 			res = m.duration ? `${res} ${this.i18n[lang].during} ${self.durationToString(m.duration)}` : res;
	// 			return res;
	// 		}.bind(this),
	// 		'productToString': function (m, lang) {
	// 			if (!m) {
	// 				return "";
	// 			}
	// 			return m.intendedname;
	// 		}.bind(this),
	// 		'posologyToString': function (m, lang) {
	// 			if (m.instructionForPatient && m.instructionForPatient.length) {
	// 				return m.instructionForPatient;
	// 			}
	// 			if (!m.regimen || !m.regimen.length) {
	// 				return '';
	// 			}
    //
	// 			let unit = m.regimen[0].administratedQuantity && m.regimen[0].administratedQuantity.administrationUnit ? m.regimen[0].administratedQuantity.administrationUnit.code : m.regimen[0].administratedQuantity && m.regimen[0].administratedQuantity.unit;
	// 			let quantity = m.regimen[0].administratedQuantity && m.regimen[0].administratedQuantity.quantity;
    //
	// 			m.regimen.slice(1).find(ri => {
	// 				let oUnit = ri.administratedQuantity && ri.administratedQuantity.administrationUnit ? ri.administratedQuantity.administrationUnit.code : ri.administratedQuantity && ri.administratedQuantity.unit;
	// 				let oQuantity = ri.administratedQuantity && ri.administratedQuantity.quantity;
    //
	// 				if (oQuantity !== quantity) {
	// 					quantity = -1;
	// 				}
	// 				return oUnit !== unit && oQuantity !== quantity;
	// 			});
    //
	// 			const cplxRegimen = !unit || quantity < 0;
	// 			const quantityUnit = cplxRegimen ? `1 ${this.i18n[lang].take_s_}` : `${quantity} ${unit || this.i18n[lang].take_s_}`;
    //
	// 			const dayPeriod = m.regimen.find(r => r.weekday !== null && r.weekday !== undefined) ? this.i18n[lang].weekly : m.regimen.find(r => r.date) ? this.i18n[lang].monthly : this.i18n[lang].daily;
    //
	// 			return `${quantityUnit}, ${m.regimen.length} x ${dayPeriod}, ${_.sortBy(m.regimen, r => (r.date ? r.date * 1000000 : 29990000000000) + (r.dayNumber || 0) * 1000000 + (r.weekday && r.weekday.weekNumber || 0) * 7 * 1000000 + (r.timeOfDay ? r.timeOfDay : r.dayPeriod && r.dayPeriod.code ? self.regimenScores[r.dayPeriod.code] : 0)).map(r => cplxRegimen ? self.regimenToExtString(r, lang) : self.regimenToString(r, lang)).join(', ')}`;
	// 		}.bind(this),
	// 		'durationToString': function (d, lang) {
	// 			return d.value ? `${d.value} ${this.localize(d.unit.label, lang)}` : '';
	// 		}.bind(this),
	// 		'regimenToExtString': function (r, lang) {
	// 			const desc = self.regimenToString(r, lang);
	// 			return (r.administratedQuantity && r.administratedQuantity.quantity && desc ? `${desc} (${r.administratedQuantity.quantity} ${(r.administratedQuantity.administrationUnit ? r.administratedQuantity.administrationUnit.code : r.administratedQuantity.unit) || this.i18n[lang].take_s_})` : desc) || '';
	// 		}.bind(this),
	// 		'regimenToString': function (r, lang) {
	// 			let res = r.date ? `${this.i18n[lang].the} ${moment(r.date).format('DD/MM/YYYY')}` : r.dayNumber ? `${this.i18n[lang].onDay} ${r.dayNumber}` : r.weekday && r.weekday.weekday ? `${this.i18n[lang].on} ${r.weekday.weekday}` : null;
	// 			if (r.dayPeriod && r.dayPeriod.code && r.dayPeriod.code.length) {
	// 				res = res ? `${res} ${this.i18n[lang][r.dayPeriod.code] || this.localize(r.dayPeriod.label) || r.dayPeriod.code}` : this.i18n[lang][r.dayPeriod.code] || this.localize(r.dayPeriod.label) || r.dayPeriod.code;
	// 			}
	// 			if (r.timeOfDay) {
	// 				const timeOfDay = r.timeOfDay === 120000 ? this.i18n[lang].noon : `${Math.floor(r.timeOfDay / 10000)}:${('' + Math.floor(r.timeOfDay / 100) % 100).replace(/^(.)$/, '0$1')}`;
	// 				res = res ? res + ' ' + this.i18n[lang].at + ' ' + timeOfDay : timeOfDay;
	// 			}
	// 			return res;
	// 		}.bind(this),
	// 		'localize': function (s, lang) {
	// 			if (!s) {
	// 				return s;
	// 			}
	// 			return this.i18n[lang][s] || this.i18n[lang][s.toLowerCase()] && this.i18n[lang][s.toLowerCase()].split('').map((c, idx) => idx >= s.length || s[idx].toLocaleLowerCase() === s[idx] ? c : c.toLocaleUpperCase()).join('') || s; //Applies the (lower/upper)case to the translated lowercase version of the input string (s)
	// 		}.bind(this)
	// 	};
	// 	return self;
	// }

}
