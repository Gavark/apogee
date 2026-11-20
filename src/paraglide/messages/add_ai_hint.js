/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_HintInputs */



/**
* | output |
* | --- |
* | "A photo of the label is enough: AI fills in the form and suggests a window." |
*
* @param {Add_Ai_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_hint = /** @type {((inputs?: Add_Ai_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("A photo of the label is enough: AI fills in the form and suggests a window.")
	return /** @type {LocalizedString} */ ("Une photo de l'étiquette suffit : l'IA pré-remplit la fiche et propose une fenêtre.")
});