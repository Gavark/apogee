/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Ai_EstimateInputs */



/**
* | output |
* | --- |
* | "Estimate with AI" |
*
* @param {Wine_Ai_EstimateInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_ai_estimate = /** @type {((inputs?: Wine_Ai_EstimateInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Ai_EstimateInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Estimate with AI")
	return /** @type {LocalizedString} */ ("Estimer avec l'IA")
});