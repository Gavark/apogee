/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Photo_OpenInputs */



/**
* | output |
* | --- |
* | "Enlarge the label photo" |
*
* @param {Wine_Photo_OpenInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_photo_open = /** @type {((inputs?: Wine_Photo_OpenInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Photo_OpenInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Enlarge the label photo")
	return /** @type {LocalizedString} */ ("Agrandir la photo de l'étiquette")
});