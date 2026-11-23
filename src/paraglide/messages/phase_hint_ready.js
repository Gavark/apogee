/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Phase_Hint_ReadyInputs */



/**
* | output |
* | --- |
* | "Good to drink, and it may still improve." |
*
* @param {Phase_Hint_ReadyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const phase_hint_ready = /** @type {((inputs?: Phase_Hint_ReadyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Phase_Hint_ReadyInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Good to drink, and it may still improve.")
	return /** @type {LocalizedString} */ ("Bon à boire, il peut encore progresser.")
});