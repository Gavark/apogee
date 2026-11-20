/* eslint-disable */
import * as __paraglideRegistry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Wine_Toast_MovedInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} bottle moved." |
* | * | "{count} bottles moved." |
*
* @param {Wine_Toast_MovedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_toast_moved = /** @type {((inputs: Wine_Toast_MovedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Toast_MovedInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = __paraglideRegistry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} bottle moved.`);
		return /** @type {LocalizedString} */ (`${i?.count} bottles moved.`)
	}
	{
		const countPlural = __paraglideRegistry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} bouteille déplacée.`);
		return /** @type {LocalizedString} */ (`${i?.count} bouteilles déplacées.`)
	}
});