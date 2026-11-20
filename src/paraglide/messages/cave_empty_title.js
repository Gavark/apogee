/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Cave_Empty_TitleInputs */



/**
* | output |
* | --- |
* | "No wine matches" |
*
* @param {Cave_Empty_TitleInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const cave_empty_title = /** @type {((inputs?: Cave_Empty_TitleInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Cave_Empty_TitleInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("No wine matches")
	return /** @type {LocalizedString} */ ("Aucun vin ne correspond")
});