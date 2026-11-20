/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Form_Err_Producer_RequiredInputs */



/**
* | output |
* | --- |
* | "Enter at least a producer, a cuvée or an appellation." |
*
* @param {Form_Err_Producer_RequiredInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const form_err_producer_required = /** @type {((inputs?: Form_Err_Producer_RequiredInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Form_Err_Producer_RequiredInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Enter at least a producer, a cuvée or an appellation.")
	return /** @type {LocalizedString} */ ("Indiquez au moins un producteur, une cuvée ou une appellation.")
});