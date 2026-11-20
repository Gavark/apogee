/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Color_RoseInputs */



/**
* | output |
* | --- |
* | "Rosé" |
*
* @param {Dev_Sg_Color_RoseInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_color_rose = /** @type {((inputs?: Dev_Sg_Color_RoseInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Color_RoseInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Rosé")
	return /** @type {LocalizedString} */ ("Rosé")
});