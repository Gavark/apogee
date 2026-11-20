/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Error_Not_ConfiguredInputs */



/**
* | output |
* | --- |
* | "AI analysis is not enabled — enter the wine." |
*
* @param {Add_Ai_Error_Not_ConfiguredInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_error_not_configured = /** @type {((inputs?: Add_Ai_Error_Not_ConfiguredInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Error_Not_ConfiguredInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("AI analysis is not enabled — enter the wine.")
	return /** @type {LocalizedString} */ ("L'analyse par IA n'est pas activée — saisissez le vin.")
});