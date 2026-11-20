/* eslint-disable */
import * as registry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Notif_Digest_ReadyInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} wine is ready to drink" |
* | * | "{count} wines are ready to drink" |
*
* @param {Notif_Digest_ReadyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_digest_ready = /** @type {((inputs: Notif_Digest_ReadyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Digest_ReadyInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = registry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} wine is ready to drink`);
		return /** @type {LocalizedString} */ (`${i?.count} wines are ready to drink`)
	}
	{
		const countPlural = registry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} vin est prêt à boire`);
		return /** @type {LocalizedString} */ (`${i?.count} vins sont prêts à boire`)
	}
});