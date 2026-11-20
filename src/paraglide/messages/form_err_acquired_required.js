/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Form_Err_Acquired_RequiredInputs */



/**
* | output |
* | --- |
* | "Enter the year it entered the cellar." |
*
* @param {Form_Err_Acquired_RequiredInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const form_err_acquired_required = /** @type {((inputs?: Form_Err_Acquired_RequiredInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Form_Err_Acquired_RequiredInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Enter the year it entered the cellar.")
	return /** @type {LocalizedString} */ ("Indiquez l'année d'entrée en cave.")
});