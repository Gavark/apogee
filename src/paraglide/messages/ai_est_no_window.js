/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_Est_No_WindowInputs */



/**
* | output |
* | --- |
* | "The AI could not propose a window for this wine." |
*
* @param {Ai_Est_No_WindowInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const ai_est_no_window = /** @type {((inputs?: Ai_Est_No_WindowInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_Est_No_WindowInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The AI could not propose a window for this wine.")
	return /** @type {LocalizedString} */ ("L'IA n'a pas pu proposer de fenêtre pour ce vin.")
});