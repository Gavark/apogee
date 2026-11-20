/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Loc_Err_EmptyInputs */



/**
* | output |
* | --- |
* | "The name must be 1 to 60 characters." |
*
* @param {Loc_Err_EmptyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const loc_err_empty = /** @type {((inputs?: Loc_Err_EmptyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loc_Err_EmptyInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The name must be 1 to 60 characters.")
	return /** @type {LocalizedString} */ ("Le nom doit contenir entre 1 et 60 caractères.")
});