/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Btn_DangerInputs */



/**
* | output |
* | --- |
* | "Delete" |
*
* @param {Dev_Sg_Btn_DangerInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_btn_danger = /** @type {((inputs?: Dev_Sg_Btn_DangerInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Btn_DangerInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Delete")
	return /** @type {LocalizedString} */ ("Supprimer")
});