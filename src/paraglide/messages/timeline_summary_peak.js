/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ from: NonNullable<unknown>, until: NonNullable<unknown>, peakFrom: NonNullable<unknown>, peakTo: NonNullable<unknown>, current: NonNullable<unknown> }} Timeline_Summary_PeakInputs */



/**
* | output |
* | --- |
* | "Drink from {from} to {until}, at its peak from {peakFrom} to {peakTo}. It is now {current}." |
*
* @param {Timeline_Summary_PeakInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const timeline_summary_peak = /** @type {((inputs: Timeline_Summary_PeakInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Timeline_Summary_PeakInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Drink from ${i?.from} to ${i?.until}, at its peak from ${i?.peakFrom} to ${i?.peakTo}. It is now ${i?.current}.`)
	return /** @type {LocalizedString} */ (`À boire de ${i?.from} à ${i?.until}, apogée de ${i?.peakFrom} à ${i?.peakTo}. Nous sommes en ${i?.current}.`)
});