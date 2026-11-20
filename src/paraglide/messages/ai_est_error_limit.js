/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_Est_Error_LimitInputs */



/**
* | output |
* | --- |
* | "Daily analysis limit reached." |
*
* @param {Ai_Est_Error_LimitInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const ai_est_error_limit = /** @type {((inputs?: Ai_Est_Error_LimitInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_Est_Error_LimitInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Daily analysis limit reached.")
	return /** @type {LocalizedString} */ ("Limite d'analyses du jour atteinte.")
});