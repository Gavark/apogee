/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Loc_Add_PlaceholderInputs */



/**
* | output |
* | --- |
* | "Cellar, Wine fridge…" |
*
* @param {Loc_Add_PlaceholderInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const loc_add_placeholder = /** @type {((inputs?: Loc_Add_PlaceholderInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loc_Add_PlaceholderInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Cellar, Wine fridge…")
	return /** @type {LocalizedString} */ ("Cave, Cave électrique…")
});