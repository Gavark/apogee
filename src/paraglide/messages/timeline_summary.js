/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ from: NonNullable<unknown>, until: NonNullable<unknown>, current: NonNullable<unknown> }} Timeline_SummaryInputs */



/**
* | output |
* | --- |
* | "Drink from {from} to {until}. It is now {current}." |
*
* @param {Timeline_SummaryInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const timeline_summary = /** @type {((inputs: Timeline_SummaryInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Timeline_SummaryInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Drink from ${i?.from} to ${i?.until}. It is now ${i?.current}.`)
	return /** @type {LocalizedString} */ (`À boire de ${i?.from} à ${i?.until}. Nous sommes en ${i?.current}.`)
});