/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Form_Err_Quantity_InvalidInputs */



/**
* | output |
* | --- |
* | "Enter a quantity between 1 and 10,000." |
*
* @param {Form_Err_Quantity_InvalidInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const form_err_quantity_invalid = /** @type {((inputs?: Form_Err_Quantity_InvalidInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Form_Err_Quantity_InvalidInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Enter a quantity between 1 and 10,000.")
	return /** @type {LocalizedString} */ ("Indiquez une quantité entre 1 et 10 000.")
});