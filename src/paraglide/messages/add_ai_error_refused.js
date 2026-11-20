/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Error_RefusedInputs */



/**
* | output |
* | --- |
* | "The AI could not read this photo — enter the wine." |
*
* @param {Add_Ai_Error_RefusedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_error_refused = /** @type {((inputs?: Add_Ai_Error_RefusedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Error_RefusedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The AI could not read this photo — enter the wine.")
	return /** @type {LocalizedString} */ ("L'IA n'a pas pu lire cette photo — saisissez le vin.")
});