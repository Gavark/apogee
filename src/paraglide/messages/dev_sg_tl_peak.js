/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Tl_PeakInputs */



/**
* | output |
* | --- |
* | "With a peak, right in it" |
*
* @param {Dev_Sg_Tl_PeakInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_tl_peak = /** @type {((inputs?: Dev_Sg_Tl_PeakInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Tl_PeakInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("With a peak, right in it")
	return /** @type {LocalizedString} */ ("Avec apogée, en plein dedans")
});