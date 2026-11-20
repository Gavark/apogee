/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Limit_UnlimitedInputs */



/**
* | output |
* | --- |
* | "Limit: none (unlimited analyses)" |
*
* @param {Admin_Ai_Limit_UnlimitedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_limit_unlimited = /** @type {((inputs?: Admin_Ai_Limit_UnlimitedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Limit_UnlimitedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Limit: none (unlimited analyses)")
	return /** @type {LocalizedString} */ ("Limite : aucune (analyses illimitées)")
});