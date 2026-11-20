/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Loc_Bottle_CountInputs */



/**
* | output |
* | --- |
* | "{count} bottle(s)" |
*
* @param {Loc_Bottle_CountInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const loc_bottle_count = /** @type {((inputs: Loc_Bottle_CountInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loc_Bottle_CountInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`${i?.count} bottle(s)`)
	return /** @type {LocalizedString} */ (`${i?.count} bouteille(s)`)
});