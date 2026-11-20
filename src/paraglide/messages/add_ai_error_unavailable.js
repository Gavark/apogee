/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Error_UnavailableInputs */



/**
* | output |
* | --- |
* | "Analysis unavailable — enter the wine, the photo is kept." |
*
* @param {Add_Ai_Error_UnavailableInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_error_unavailable = /** @type {((inputs?: Add_Ai_Error_UnavailableInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Error_UnavailableInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Analysis unavailable — enter the wine, the photo is kept.")
	return /** @type {LocalizedString} */ ("Analyse indisponible — saisissez le vin, la photo est gardée.")
});