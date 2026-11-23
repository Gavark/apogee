/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_History_Verdict_AddInputs */



/**
* | output |
* | --- |
* | "Add a verdict" |
*
* @param {Wine_History_Verdict_AddInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_history_verdict_add = /** @type {((inputs?: Wine_History_Verdict_AddInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_History_Verdict_AddInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Add a verdict")
	return /** @type {LocalizedString} */ ("Donner un verdict")
});