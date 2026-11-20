/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Form_Acquired_HintInputs */



/**
* | output |
* | --- |
* | "Tells successive purchases of a non-vintage wine apart." |
*
* @param {Form_Acquired_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const form_acquired_hint = /** @type {((inputs?: Form_Acquired_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Form_Acquired_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Tells successive purchases of a non-vintage wine apart.")
	return /** @type {LocalizedString} */ ("Distingue les achats successifs d'un vin sans millésime.")
});