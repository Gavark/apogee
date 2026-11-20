/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ peakFrom: NonNullable<unknown>, peakTo: NonNullable<unknown> }} Timeline_Peak_RangeInputs */



/**
* | output |
* | --- |
* | "Peak {peakFrom}-{peakTo}" |
*
* @param {Timeline_Peak_RangeInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const timeline_peak_range = /** @type {((inputs: Timeline_Peak_RangeInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Timeline_Peak_RangeInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Peak ${i?.peakFrom}-${i?.peakTo}`)
	return /** @type {LocalizedString} */ (`Apogée ${i?.peakFrom}-${i?.peakTo}`)
});