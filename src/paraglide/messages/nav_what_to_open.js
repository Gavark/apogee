/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Nav_What_To_OpenInputs */



/**
* | output |
* | --- |
* | "What to open" |
*
* @param {Nav_What_To_OpenInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const nav_what_to_open = /** @type {((inputs?: Nav_What_To_OpenInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Nav_What_To_OpenInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("What to open")
	return /** @type {LocalizedString} */ ("Quoi ouvrir")
});