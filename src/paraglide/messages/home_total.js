/* eslint-disable */
import * as registry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Home_TotalInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} bottle in the cellar" |
* | * | "{count} bottles in the cellar" |
*
* @param {Home_TotalInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const home_total = /** @type {((inputs: Home_TotalInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_TotalInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = registry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} bottle in the cellar`);
		return /** @type {LocalizedString} */ (`${i?.count} bottles in the cellar`)
	}
	{
		const countPlural = registry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} bouteille en cave`);
		return /** @type {LocalizedString} */ (`${i?.count} bouteilles en cave`)
	}
});