/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Attach_ReplaceInputs */



/**
* | output |
* | --- |
* | "Change photo" |
*
* @param {Add_Ai_Attach_ReplaceInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_attach_replace = /** @type {((inputs?: Add_Ai_Attach_ReplaceInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Attach_ReplaceInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Change photo")
	return /** @type {LocalizedString} */ ("Changer la photo")
});