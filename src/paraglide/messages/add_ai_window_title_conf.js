/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ confidence: NonNullable<unknown> }} Add_Ai_Window_Title_ConfInputs */



/**
* | output |
* | --- |
* | "Suggested by AI ({confidence})" |
*
* @param {Add_Ai_Window_Title_ConfInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_window_title_conf = /** @type {((inputs: Add_Ai_Window_Title_ConfInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Window_Title_ConfInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Suggested by AI (${i?.confidence})`)
	return /** @type {LocalizedString} */ (`Proposé par l'IA (${i?.confidence})`)
});