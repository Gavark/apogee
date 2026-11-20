/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Test_Err_Not_ConfiguredInputs */



/**
* | output |
* | --- |
* | "Cannot test: AI analysis is not configured." |
*
* @param {Admin_Ai_Test_Err_Not_ConfiguredInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_test_err_not_configured = /** @type {((inputs?: Admin_Ai_Test_Err_Not_ConfiguredInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Test_Err_Not_ConfiguredInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Cannot test: AI analysis is not configured.")
	return /** @type {LocalizedString} */ ("Test impossible : l'analyse par IA n'est pas configurée.")
});