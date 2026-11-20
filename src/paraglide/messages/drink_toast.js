/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ wine: NonNullable<unknown> }} Drink_ToastInputs */



/**
* | output |
* | --- |
* | "Drunk · {wine}" |
*
* @param {Drink_ToastInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const drink_toast = /** @type {((inputs: Drink_ToastInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Drink_ToastInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Drunk · ${i?.wine}`)
	return /** @type {LocalizedString} */ (`Bue · ${i?.wine}`)
});