/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Test_Err_RefusedInputs */



/**
* | output |
* | --- |
* | "The provider refused the request." |
*
* @param {Admin_Ai_Test_Err_RefusedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_test_err_refused = /** @type {((inputs?: Admin_Ai_Test_Err_RefusedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Test_Err_RefusedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The provider refused the request.")
	return /** @type {LocalizedString} */ ("Le fournisseur a refusé la requête.")
});