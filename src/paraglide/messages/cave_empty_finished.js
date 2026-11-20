/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Cave_Empty_FinishedInputs */



/**
* | output |
* | --- |
* | "No bottle drunk yet." |
*
* @param {Cave_Empty_FinishedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const cave_empty_finished = /** @type {((inputs?: Cave_Empty_FinishedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Cave_Empty_FinishedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("No bottle drunk yet.")
	return /** @type {LocalizedString} */ ("Aucune bouteille bue pour l'instant.")
});