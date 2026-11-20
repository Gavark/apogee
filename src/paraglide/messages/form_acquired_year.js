/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Form_Acquired_YearInputs */



/**
* | output |
* | --- |
* | "Year it entered the cellar" |
*
* @param {Form_Acquired_YearInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const form_acquired_year = /** @type {((inputs?: Form_Acquired_YearInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Form_Acquired_YearInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Year it entered the cellar")
	return /** @type {LocalizedString} */ ("Année d'entrée en cave")
});