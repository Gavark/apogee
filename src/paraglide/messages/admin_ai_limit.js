/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Admin_Ai_LimitInputs */



/**
* | output |
* | --- |
* | "Limit: {count} analyses per day and per household" |
*
* @param {Admin_Ai_LimitInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_limit = /** @type {((inputs: Admin_Ai_LimitInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_LimitInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Limit: ${i?.count} analyses per day and per household`)
	return /** @type {LocalizedString} */ (`Limite : ${i?.count} analyses par jour et par foyer`)
});