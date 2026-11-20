/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Test_Err_Invalid_ResponseInputs */



/**
* | output |
* | --- |
* | "Unusable response from the provider: check the model." |
*
* @param {Admin_Ai_Test_Err_Invalid_ResponseInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_test_err_invalid_response = /** @type {((inputs?: Admin_Ai_Test_Err_Invalid_ResponseInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Test_Err_Invalid_ResponseInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Unusable response from the provider: check the model.")
	return /** @type {LocalizedString} */ ("Réponse du fournisseur inexploitable : vérifiez le modèle.")
});