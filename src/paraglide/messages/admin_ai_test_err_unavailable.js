/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Test_Err_UnavailableInputs */



/**
* | output |
* | --- |
* | "Provider unreachable: check the address, the model and the network." |
*
* @param {Admin_Ai_Test_Err_UnavailableInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_test_err_unavailable = /** @type {((inputs?: Admin_Ai_Test_Err_UnavailableInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Test_Err_UnavailableInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Provider unreachable: check the address, the model and the network.")
	return /** @type {LocalizedString} */ ("Fournisseur injoignable : vérifiez l'adresse, le modèle et le réseau.")
});