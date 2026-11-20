/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Photo_TitleInputs */



/**
* | output |
* | --- |
* | "Label" |
*
* @param {Wine_Photo_TitleInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_photo_title = /** @type {((inputs?: Wine_Photo_TitleInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Photo_TitleInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Label")
	return /** @type {LocalizedString} */ ("Étiquette")
});