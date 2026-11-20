/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Confidence_MediumInputs */



/**
* | output |
* | --- |
* | "medium confidence" |
*
* @param {Add_Ai_Confidence_MediumInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_confidence_medium = /** @type {((inputs?: Add_Ai_Confidence_MediumInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Confidence_MediumInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("medium confidence")
	return /** @type {LocalizedString} */ ("confiance moyenne")
});