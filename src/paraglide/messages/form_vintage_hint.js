/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Form_Vintage_HintInputs */



/**
* | output |
* | --- |
* | "Leave empty for a non-vintage wine." |
*
* @param {Form_Vintage_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const form_vintage_hint = /** @type {((inputs?: Form_Vintage_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Form_Vintage_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Leave empty for a non-vintage wine.")
	return /** @type {LocalizedString} */ ("Laissez vide pour un vin sans année.")
});