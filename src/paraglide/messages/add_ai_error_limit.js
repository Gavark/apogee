/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Error_LimitInputs */



/**
* | output |
* | --- |
* | "Daily analysis limit reached — enter the wine." |
*
* @param {Add_Ai_Error_LimitInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_error_limit = /** @type {((inputs?: Add_Ai_Error_LimitInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Error_LimitInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Daily analysis limit reached — enter the wine.")
	return /** @type {LocalizedString} */ ("Limite d'analyses du jour atteinte — saisissez le vin.")
});