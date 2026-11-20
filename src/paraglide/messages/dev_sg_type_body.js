/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Type_BodyInputs */



/**
* | output |
* | --- |
* | "Two bottles reach the end of their window this year. Open them before winter." |
*
* @param {Dev_Sg_Type_BodyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_type_body = /** @type {((inputs?: Dev_Sg_Type_BodyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Type_BodyInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Two bottles reach the end of their window this year. Open them before winter.")
	return /** @type {LocalizedString} */ ("Deux bouteilles arrivent au bout de leur fenêtre cette année. Ouvrez-les avant l'hiver.")
});