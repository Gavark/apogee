/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Window_Ai_WhyInputs */



/**
* | output |
* | --- |
* | "Why this estimate?" |
*
* @param {Wine_Window_Ai_WhyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_window_ai_why = /** @type {((inputs?: Wine_Window_Ai_WhyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Window_Ai_WhyInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Why this estimate?")
	return /** @type {LocalizedString} */ ("Pourquoi cette estimation ?")
});