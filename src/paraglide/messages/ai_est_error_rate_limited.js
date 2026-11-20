/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_Est_Error_Rate_LimitedInputs */



/**
* | output |
* | --- |
* | "AI service is busy — try again in a moment." |
*
* @param {Ai_Est_Error_Rate_LimitedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const ai_est_error_rate_limited = /** @type {((inputs?: Ai_Est_Error_Rate_LimitedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_Est_Error_Rate_LimitedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("AI service is busy — try again in a moment.")
	return /** @type {LocalizedString} */ ("Service d'IA saturé — réessayez dans un instant.")
});