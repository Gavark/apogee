/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ confidence: NonNullable<unknown> }} Wine_Window_AiInputs */



/**
* | output |
* | --- |
* | "Estimated by AI · {confidence}" |
*
* @param {Wine_Window_AiInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_window_ai = /** @type {((inputs: Wine_Window_AiInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Window_AiInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Estimated by AI · ${i?.confidence}`)
	return /** @type {LocalizedString} */ (`Estimée par l'IA · ${i?.confidence}`)
});