/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Form_Err_Format_InvalidInputs */



/**
* | output |
* | --- |
* | "Invalid format." |
*
* @param {Form_Err_Format_InvalidInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const form_err_format_invalid = /** @type {((inputs?: Form_Err_Format_InvalidInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Form_Err_Format_InvalidInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Invalid format.")
	return /** @type {LocalizedString} */ ("Format invalide.")
});