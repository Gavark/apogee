/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Form_Err_Location_InvalidInputs */



/**
* | output |
* | --- |
* | "Choose a location." |
*
* @param {Form_Err_Location_InvalidInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const form_err_location_invalid = /** @type {((inputs?: Form_Err_Location_InvalidInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Form_Err_Location_InvalidInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Choose a location.")
	return /** @type {LocalizedString} */ ("Choisissez un lieu.")
});