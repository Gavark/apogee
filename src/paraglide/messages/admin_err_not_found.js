/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Err_Not_FoundInputs */



/**
* | output |
* | --- |
* | "Not found: maybe already deleted." |
*
* @param {Admin_Err_Not_FoundInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_err_not_found = /** @type {((inputs?: Admin_Err_Not_FoundInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Err_Not_FoundInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Not found: maybe already deleted.")
	return /** @type {LocalizedString} */ ("Introuvable : peut-être déjà supprimé.")
});