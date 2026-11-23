/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_History_Verdict_EditInputs */



/**
* | output |
* | --- |
* | "Change the verdict" |
*
* @param {Wine_History_Verdict_EditInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_history_verdict_edit = /** @type {((inputs?: Wine_History_Verdict_EditInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_History_Verdict_EditInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Change the verdict")
	return /** @type {LocalizedString} */ ("Modifier le verdict")
});