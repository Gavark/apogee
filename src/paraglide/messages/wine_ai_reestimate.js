/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Ai_ReestimateInputs */



/**
* | output |
* | --- |
* | "Re-estimate with AI" |
*
* @param {Wine_Ai_ReestimateInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_ai_reestimate = /** @type {((inputs?: Wine_Ai_ReestimateInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Ai_ReestimateInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Re-estimate with AI")
	return /** @type {LocalizedString} */ ("Ré-estimer avec l'IA")
});