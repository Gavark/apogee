/* eslint-disable */
import * as __paraglideRegistry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Notif_Digest_PeakInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} wine is reaching its peak" |
* | * | "{count} wines are reaching their peak" |
*
* @param {Notif_Digest_PeakInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_digest_peak = /** @type {((inputs: Notif_Digest_PeakInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Digest_PeakInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = __paraglideRegistry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} wine is reaching its peak`);
		return /** @type {LocalizedString} */ (`${i?.count} wines are reaching their peak`)
	}
	{
		const countPlural = __paraglideRegistry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} vin entre à son apogée`);
		return /** @type {LocalizedString} */ (`${i?.count} vins entrent à leur apogée`)
	}
});