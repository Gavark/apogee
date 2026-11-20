/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Error_Rate_LimitedInputs */



/**
* | output |
* | --- |
* | "AI service is busy — try again shortly or enter the wine." |
*
* @param {Add_Ai_Error_Rate_LimitedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_error_rate_limited = /** @type {((inputs?: Add_Ai_Error_Rate_LimitedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Error_Rate_LimitedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("AI service is busy — try again shortly or enter the wine.")
	return /** @type {LocalizedString} */ ("Service d'IA saturé — réessayez dans un instant ou saisissez le vin.")
});