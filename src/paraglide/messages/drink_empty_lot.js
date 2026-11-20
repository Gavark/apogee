/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Drink_Empty_LotInputs */



/**
* | output |
* | --- |
* | "No bottle left at this spot" |
*
* @param {Drink_Empty_LotInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const drink_empty_lot = /** @type {((inputs?: Drink_Empty_LotInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Drink_Empty_LotInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("No bottle left at this spot")
	return /** @type {LocalizedString} */ ("Plus de bouteille à cet endroit")
});