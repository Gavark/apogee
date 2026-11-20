/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Theme_Label_DarkInputs */



/**
* | output |
* | --- |
* | "Theme: dark" |
*
* @param {Theme_Label_DarkInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const theme_label_dark = /** @type {((inputs?: Theme_Label_DarkInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Theme_Label_DarkInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Theme: dark")
	return /** @type {LocalizedString} */ ("Thème : sombre")
});