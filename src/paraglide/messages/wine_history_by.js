/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ user: NonNullable<unknown> }} Wine_History_ByInputs */



/**
* | output |
* | --- |
* | "by {user}" |
*
* @param {Wine_History_ByInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_history_by = /** @type {((inputs: Wine_History_ByInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_History_ByInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`by ${i?.user}`)
	return /** @type {LocalizedString} */ (`par ${i?.user}`)
});