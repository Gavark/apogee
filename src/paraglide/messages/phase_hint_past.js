/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Phase_Hint_PastInputs */



/**
* | output |
* | --- |
* | "Its window has closed: drink it now." |
*
* @param {Phase_Hint_PastInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const phase_hint_past = /** @type {((inputs?: Phase_Hint_PastInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Phase_Hint_PastInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Its window has closed: drink it now.")
	return /** @type {LocalizedString} */ ("La fenêtre est dépassée : buvez-le sans attendre.")
});