/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Btn_PrimaryInputs */



/**
* | output |
* | --- |
* | "Save" |
*
* @param {Dev_Sg_Btn_PrimaryInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_btn_primary = /** @type {((inputs?: Dev_Sg_Btn_PrimaryInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Btn_PrimaryInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Save")
	return /** @type {LocalizedString} */ ("Enregistrer")
});