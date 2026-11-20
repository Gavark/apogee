/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_Est_TitleInputs */



/**
* | output |
* | --- |
* | "AI estimate" |
*
* @param {Ai_Est_TitleInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const ai_est_title = /** @type {((inputs?: Ai_Est_TitleInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_Est_TitleInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("AI estimate")
	return /** @type {LocalizedString} */ ("Estimation par l'IA")
});