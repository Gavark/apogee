/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Window_CheckInputs */



/**
* | output |
* | --- |
* | "This is an estimate: check it before saving." |
*
* @param {Add_Ai_Window_CheckInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_window_check = /** @type {((inputs?: Add_Ai_Window_CheckInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Window_CheckInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This is an estimate: check it before saving.")
	return /** @type {LocalizedString} */ ("Estimation : vérifiez-la avant d'enregistrer.")
});