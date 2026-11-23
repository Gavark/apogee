/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Phase_Legend_IntroInputs */



/**
* | output |
* | --- |
* | "Most urgent first." |
*
* @param {Phase_Legend_IntroInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const phase_legend_intro = /** @type {((inputs?: Phase_Legend_IntroInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Phase_Legend_IntroInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Most urgent first.")
	return /** @type {LocalizedString} */ ("Du plus urgent au moins urgent.")
});