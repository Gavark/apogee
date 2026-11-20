/* eslint-disable */
import * as registry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Add_Dup_BodyInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} bottle is in stock." |
* | * | "{count} bottles are in stock." |
*
* @param {Add_Dup_BodyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_dup_body = /** @type {((inputs: Add_Dup_BodyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Dup_BodyInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = registry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} bottle is in stock.`);
		return /** @type {LocalizedString} */ (`${i?.count} bottles are in stock.`)
	}
	{
		const countPlural = registry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`Il en reste ${i?.count} bouteille.`);
		return /** @type {LocalizedString} */ (`Il en reste ${i?.count} bouteilles.`)
	}
});