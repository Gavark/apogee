/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Test_Err_AuthInputs */



/**
* | output |
* | --- |
* | "Access denied by the provider: check the key (AI_API_KEY)." |
*
* @param {Admin_Ai_Test_Err_AuthInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_test_err_auth = /** @type {((inputs?: Admin_Ai_Test_Err_AuthInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Test_Err_AuthInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Access denied by the provider: check the key (AI_API_KEY).")
	return /** @type {LocalizedString} */ ("Accès refusé par le fournisseur : vérifiez la clé (AI_API_KEY).")
});