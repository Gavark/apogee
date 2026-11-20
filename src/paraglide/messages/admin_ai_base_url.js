/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ url: NonNullable<unknown> }} Admin_Ai_Base_UrlInputs */



/**
* | output |
* | --- |
* | "Address: {url}" |
*
* @param {Admin_Ai_Base_UrlInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_base_url = /** @type {((inputs: Admin_Ai_Base_UrlInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Base_UrlInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Address: ${i?.url}`)
	return /** @type {LocalizedString} */ (`Adresse : ${i?.url}`)
});