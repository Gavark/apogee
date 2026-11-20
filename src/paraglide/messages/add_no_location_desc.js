/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_No_Location_DescInputs */



/**
* | output |
* | --- |
* | "A bottle always lives somewhere: add your cellar, a cupboard…" |
*
* @param {Add_No_Location_DescInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_no_location_desc = /** @type {((inputs?: Add_No_Location_DescInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_No_Location_DescInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("A bottle always lives somewhere: add your cellar, a cupboard…")
	return /** @type {LocalizedString} */ ("Une bouteille est toujours rangée quelque part : ajoutez votre cave, un cellier…")
});