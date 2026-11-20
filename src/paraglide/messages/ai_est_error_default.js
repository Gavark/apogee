/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_Est_Error_DefaultInputs */



/**
* | output |
* | --- |
* | "Estimate unavailable right now, please try again later." |
*
* @param {Ai_Est_Error_DefaultInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const ai_est_error_default = /** @type {((inputs?: Ai_Est_Error_DefaultInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_Est_Error_DefaultInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Estimate unavailable right now, please try again later.")
	return /** @type {LocalizedString} */ ("Estimation impossible pour l'instant, réessayez plus tard.")
});