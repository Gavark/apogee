/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ model: NonNullable<unknown> }} Admin_Ai_ModelInputs */



/**
* | output |
* | --- |
* | "Model: {model}" |
*
* @param {Admin_Ai_ModelInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_model = /** @type {((inputs: Admin_Ai_ModelInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_ModelInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Model: ${i?.model}`)
	return /** @type {LocalizedString} */ (`Modèle : ${i?.model}`)
});