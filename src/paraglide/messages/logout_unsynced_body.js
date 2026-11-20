/* eslint-disable */
import * as __paraglideRegistry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Logout_Unsynced_BodyInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} change hasn't been synced yet: stay logged in and get back online to send it" |
* | * | "{count} changes haven't been synced yet: stay logged in and get back online to send them" |
*
* @param {Logout_Unsynced_BodyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const logout_unsynced_body = /** @type {((inputs: Logout_Unsynced_BodyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Logout_Unsynced_BodyInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = __paraglideRegistry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} change hasn't been synced yet: stay logged in and get back online to send it`);
		return /** @type {LocalizedString} */ (`${i?.count} changes haven't been synced yet: stay logged in and get back online to send them`)
	}
	{
		const countPlural = __paraglideRegistry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} geste n'est pas encore synchronisé : restez connecté et reconnectez-vous au réseau pour l'envoyer`);
		return /** @type {LocalizedString} */ (`${i?.count} gestes ne sont pas encore synchronisés : restez connecté et reconnectez-vous au réseau pour les envoyer`)
	}
});