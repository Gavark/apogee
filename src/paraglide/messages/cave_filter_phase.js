/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Cave_Filter_PhaseInputs */



/**
* | output |
* | --- |
* | "Phase" |
*
* @param {Cave_Filter_PhaseInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const cave_filter_phase = /** @type {((inputs?: Cave_Filter_PhaseInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Cave_Filter_PhaseInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Phase")
	return /** @type {LocalizedString} */ ("Phase")
});