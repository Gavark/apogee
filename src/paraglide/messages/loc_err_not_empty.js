/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Loc_Err_Not_EmptyInputs */



/**
* | output |
* | --- |
* | "This location still holds {count} bottle(s)." |
*
* @param {Loc_Err_Not_EmptyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const loc_err_not_empty = /** @type {((inputs: Loc_Err_Not_EmptyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loc_Err_Not_EmptyInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`This location still holds ${i?.count} bottle(s).`)
	return /** @type {LocalizedString} */ (`Ce lieu contient encore ${i?.count} bouteille(s).`)
});