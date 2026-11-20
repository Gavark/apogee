/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Field_Name_HintInputs */



/**
* | output |
* | --- |
* | "As written on the label." |
*
* @param {Dev_Sg_Field_Name_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_field_name_hint = /** @type {((inputs?: Dev_Sg_Field_Name_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Field_Name_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("As written on the label.")
	return /** @type {LocalizedString} */ ("Tel qu'écrit sur l'étiquette.")
});