/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Err_OpInputs */



/**
* | output |
* | --- |
* | "The operation failed. Please try again." |
*
* @param {Wine_Err_OpInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_err_op = /** @type {((inputs?: Wine_Err_OpInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Err_OpInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The operation failed. Please try again.")
	return /** @type {LocalizedString} */ ("L'opération a échoué. Réessayez.")
});