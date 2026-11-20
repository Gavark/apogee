/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Window_UnknownInputs */



/**
* | output |
* | --- |
* | "No drinking window entered yet." |
*
* @param {Wine_Window_UnknownInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_window_unknown = /** @type {((inputs?: Wine_Window_UnknownInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Window_UnknownInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("No drinking window entered yet.")
	return /** @type {LocalizedString} */ ("Aucune fenêtre renseignée pour l'instant.")
});