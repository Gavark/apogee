/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ year: NonNullable<unknown> }} Dev_Sg_Card_UntilInputs */



/**
* | output |
* | --- |
* | "until {year}" |
*
* @param {Dev_Sg_Card_UntilInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_card_until = /** @type {((inputs: Dev_Sg_Card_UntilInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Card_UntilInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`until ${i?.year}`)
	return /** @type {LocalizedString} */ (`jusqu'à ${i?.year}`)
});