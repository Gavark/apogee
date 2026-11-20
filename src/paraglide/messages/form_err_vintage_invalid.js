/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Form_Err_Vintage_InvalidInputs */



/**
* | output |
* | --- |
* | "Invalid vintage: between 1900 and this year." |
*
* @param {Form_Err_Vintage_InvalidInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const form_err_vintage_invalid = /** @type {((inputs?: Form_Err_Vintage_InvalidInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Form_Err_Vintage_InvalidInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Invalid vintage: between 1900 and this year.")
	return /** @type {LocalizedString} */ ("Millésime invalide : entre 1900 et cette année.")
});