/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Sheet_OpenInputs */



/**
* | output |
* | --- |
* | "Open the sheet" |
*
* @param {Dev_Sg_Sheet_OpenInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_sheet_open = /** @type {((inputs?: Dev_Sg_Sheet_OpenInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Sheet_OpenInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Open the sheet")
	return /** @type {LocalizedString} */ ("Ouvrir la feuille")
});