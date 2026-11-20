/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_TitleInputs */



/**
* | output |
* | --- |
* | "AI label analysis" |
*
* @param {Admin_Ai_TitleInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_title = /** @type {((inputs?: Admin_Ai_TitleInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_TitleInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("AI label analysis")
	return /** @type {LocalizedString} */ ("Analyse IA de l'étiquette")
});