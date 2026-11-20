/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Error_AuthInputs */



/**
* | output |
* | --- |
* | "AI service access denied — enter the wine and tell the administrator." |
*
* @param {Add_Ai_Error_AuthInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_error_auth = /** @type {((inputs?: Add_Ai_Error_AuthInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Error_AuthInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("AI service access denied — enter the wine and tell the administrator.")
	return /** @type {LocalizedString} */ ("Accès au service d'IA refusé — saisissez le vin et prévenez l'administrateur.")
});