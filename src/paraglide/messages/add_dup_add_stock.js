/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Dup_Add_StockInputs */



/**
* | output |
* | --- |
* | "Add to the existing stock" |
*
* @param {Add_Dup_Add_StockInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_dup_add_stock = /** @type {((inputs?: Add_Dup_Add_StockInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Dup_Add_StockInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Add to the existing stock")
	return /** @type {LocalizedString} */ ("Ajouter au stock existant")
});