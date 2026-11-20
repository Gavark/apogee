/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Tl_NopeakInputs */



/**
* | output |
* | --- |
* | "No peak, final year" |
*
* @param {Dev_Sg_Tl_NopeakInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_tl_nopeak = /** @type {((inputs?: Dev_Sg_Tl_NopeakInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Tl_NopeakInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("No peak, final year")
	return /** @type {LocalizedString} */ ("Sans apogée, dernière année")
});