/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ provider: NonNullable<unknown> }} Admin_Ai_ProviderInputs */



/**
* | output |
* | --- |
* | "Provider: {provider}" |
*
* @param {Admin_Ai_ProviderInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_provider = /** @type {((inputs: Admin_Ai_ProviderInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_ProviderInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Provider: ${i?.provider}`)
	return /** @type {LocalizedString} */ (`Fournisseur : ${i?.provider}`)
});