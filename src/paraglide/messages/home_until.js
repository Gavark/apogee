/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ year: NonNullable<unknown> }} Home_UntilInputs */



/**
* | output |
* | --- |
* | "until {year}" |
*
* @param {Home_UntilInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const home_until = /** @type {((inputs: Home_UntilInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_UntilInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`until ${i?.year}`)
	return /** @type {LocalizedString} */ (`jusqu'à ${i?.year}`)
});