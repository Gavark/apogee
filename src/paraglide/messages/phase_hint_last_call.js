/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Phase_Hint_Last_CallInputs */



/**
* | output |
* | --- |
* | "Past its peak, or in the last year of its window." |
*
* @param {Phase_Hint_Last_CallInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const phase_hint_last_call = /** @type {((inputs?: Phase_Hint_Last_CallInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Phase_Hint_Last_CallInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Past its peak, or in the last year of its window.")
	return /** @type {LocalizedString} */ ("Son apogée est passée, ou c'est la dernière année de sa fenêtre.")
});