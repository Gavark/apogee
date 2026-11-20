/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Error_Invalid_PhotoInputs */



/**
* | output |
* | --- |
* | "Photo unreadable or too large — try another one." |
*
* @param {Add_Ai_Error_Invalid_PhotoInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_error_invalid_photo = /** @type {((inputs?: Add_Ai_Error_Invalid_PhotoInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Error_Invalid_PhotoInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Photo unreadable or too large — try another one.")
	return /** @type {LocalizedString} */ ("Photo illisible ou trop lourde — essayez-en une autre.")
});