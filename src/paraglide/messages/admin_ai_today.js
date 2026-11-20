/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Admin_Ai_TodayInputs */



/**
* | output |
* | --- |
* | "Successful analyses today (UTC), whole instance: {count}" |
*
* @param {Admin_Ai_TodayInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_today = /** @type {((inputs: Admin_Ai_TodayInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_TodayInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Successful analyses today (UTC), whole instance: ${i?.count}`)
	return /** @type {LocalizedString} */ (`Analyses réussies aujourd'hui (UTC), toute l'instance : ${i?.count}`)
});