/* eslint-disable */
import * as __paraglideRegistry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Notif_Digest_Last_CallInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} wine should be drunk soon" |
* | * | "{count} wines should be drunk soon" |
*
* @param {Notif_Digest_Last_CallInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_digest_last_call = /** @type {((inputs: Notif_Digest_Last_CallInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Digest_Last_CallInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = __paraglideRegistry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} wine should be drunk soon`);
		return /** @type {LocalizedString} */ (`${i?.count} wines should be drunk soon`)
	}
	{
		const countPlural = __paraglideRegistry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} vin est à boire vite`);
		return /** @type {LocalizedString} */ (`${i?.count} vins sont à boire vite`)
	}
});