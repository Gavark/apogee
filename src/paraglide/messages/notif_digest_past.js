/* eslint-disable */
import * as __paraglideRegistry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Notif_Digest_PastInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} wine is past its peak" |
* | * | "{count} wines are past their peak" |
*
* @param {Notif_Digest_PastInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_digest_past = /** @type {((inputs: Notif_Digest_PastInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Digest_PastInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = __paraglideRegistry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} wine is past its peak`);
		return /** @type {LocalizedString} */ (`${i?.count} wines are past their peak`)
	}
	{
		const countPlural = __paraglideRegistry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} vin a passé son apogée`);
		return /** @type {LocalizedString} */ (`${i?.count} vins ont passé leur apogée`)
	}
});