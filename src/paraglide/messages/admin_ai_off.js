/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_OffInputs */



/**
* | output |
* | --- |
* | "Not configured. See the README to enable AI analysis." |
*
* @param {Admin_Ai_OffInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_off = /** @type {((inputs?: Admin_Ai_OffInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_OffInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Not configured. See the README to enable AI analysis.")
	return /** @type {LocalizedString} */ ("Non configurée. Voir le README pour activer l'analyse par IA.")
});