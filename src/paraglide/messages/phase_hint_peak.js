/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Phase_Hint_PeakInputs */



/**
* | output |
* | --- |
* | "The best time to open it." |
*
* @param {Phase_Hint_PeakInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const phase_hint_peak = /** @type {((inputs?: Phase_Hint_PeakInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Phase_Hint_PeakInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The best time to open it.")
	return /** @type {LocalizedString} */ ("Le meilleur moment pour l'ouvrir.")
});