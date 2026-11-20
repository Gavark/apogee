/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Confidence_HighInputs */



/**
* | output |
* | --- |
* | "high confidence" |
*
* @param {Add_Ai_Confidence_HighInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_confidence_high = /** @type {((inputs?: Add_Ai_Confidence_HighInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Confidence_HighInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("high confidence")
	return /** @type {LocalizedString} */ ("confiance élevée")
});