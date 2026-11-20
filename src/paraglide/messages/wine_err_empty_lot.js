/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Err_Empty_LotInputs */



/**
* | output |
* | --- |
* | "This lot is empty." |
*
* @param {Wine_Err_Empty_LotInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_err_empty_lot = /** @type {((inputs?: Wine_Err_Empty_LotInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Err_Empty_LotInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This lot is empty.")
	return /** @type {LocalizedString} */ ("Ce lot est vide.")
});