/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Toast_DrunkInputs */



/**
* | output |
* | --- |
* | "Bottle marked as drunk." |
*
* @param {Wine_Toast_DrunkInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_toast_drunk = /** @type {((inputs?: Wine_Toast_DrunkInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Toast_DrunkInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Bottle marked as drunk.")
	return /** @type {LocalizedString} */ ("Bouteille bue.")
});