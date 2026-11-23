/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Phase_Legend_OpenInputs */



/**
* | output |
* | --- |
* | "What the phases mean" |
*
* @param {Phase_Legend_OpenInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const phase_legend_open = /** @type {((inputs?: Phase_Legend_OpenInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Phase_Legend_OpenInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("What the phases mean")
	return /** @type {LocalizedString} */ ("Comprendre les phases")
});