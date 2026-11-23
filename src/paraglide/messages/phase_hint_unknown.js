/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Phase_Hint_UnknownInputs */



/**
* | output |
* | --- |
* | "No window yet: enter one or ask the AI for an estimate." |
*
* @param {Phase_Hint_UnknownInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const phase_hint_unknown = /** @type {((inputs?: Phase_Hint_UnknownInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Phase_Hint_UnknownInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("No window yet: enter one or ask the AI for an estimate.")
	return /** @type {LocalizedString} */ ("Pas encore de fenêtre : saisissez-la ou demandez une estimation à l'IA.")
});