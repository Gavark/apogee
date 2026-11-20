/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Loc_Err_Not_FoundInputs */



/**
* | output |
* | --- |
* | "Location not found: maybe already deleted." |
*
* @param {Loc_Err_Not_FoundInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const loc_err_not_found = /** @type {((inputs?: Loc_Err_Not_FoundInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loc_Err_Not_FoundInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Location not found: maybe already deleted.")
	return /** @type {LocalizedString} */ ("Lieu introuvable : peut-être déjà supprimé.")
});