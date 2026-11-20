/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Form_Window_HintInputs */



/**
* | output |
* | --- |
* | "Exact years, or leave everything empty if you do not know." |
*
* @param {Form_Window_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const form_window_hint = /** @type {((inputs?: Form_Window_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Form_Window_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Exact years, or leave everything empty if you do not know.")
	return /** @type {LocalizedString} */ ("Des années précises, ou tout laisser vide si vous ne savez pas.")
});