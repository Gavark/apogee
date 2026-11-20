/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Empty_BodyInputs */



/**
* | output |
* | --- |
* | "Add your bottles and Apogée will tell you which ones to open, and when." |
*
* @param {Dev_Sg_Empty_BodyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_empty_body = /** @type {((inputs?: Dev_Sg_Empty_BodyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Empty_BodyInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Add your bottles and Apogée will tell you which ones to open, and when.")
	return /** @type {LocalizedString} */ ("Ajoutez vos bouteilles : Apogée vous dira lesquelles ouvrir, et quand.")
});