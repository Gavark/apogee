/* eslint-disable */
import * as registry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Wine_Bottle_CountInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} bottle" |
* | * | "{count} bottles" |
*
* @param {Wine_Bottle_CountInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_bottle_count = /** @type {((inputs: Wine_Bottle_CountInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Bottle_CountInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = registry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} bottle`);
		return /** @type {LocalizedString} */ (`${i?.count} bottles`)
	}
	{
		const countPlural = registry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} bouteille`);
		return /** @type {LocalizedString} */ (`${i?.count} bouteilles`)
	}
});