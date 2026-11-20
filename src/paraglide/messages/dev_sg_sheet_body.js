/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Sheet_BodyInputs */



/**
* | output |
* | --- |
* | "This wine is stored in two places. Pick the bottle you are opening." |
*
* @param {Dev_Sg_Sheet_BodyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_sheet_body = /** @type {((inputs?: Dev_Sg_Sheet_BodyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Sheet_BodyInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This wine is stored in two places. Pick the bottle you are opening.")
	return /** @type {LocalizedString} */ ("Ce vin est rangé à deux endroits. Choisissez la bouteille que vous ouvrez.")
});