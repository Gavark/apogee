/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Home_Empty_DescInputs */



/**
* | output |
* | --- |
* | "Add a first wine: Apogée will tell you when to open it." |
*
* @param {Home_Empty_DescInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const home_empty_desc = /** @type {((inputs?: Home_Empty_DescInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_Empty_DescInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Add a first wine: Apogée will tell you when to open it.")
	return /** @type {LocalizedString} */ ("Ajoutez un premier vin : Apogée vous dira quand l'ouvrir.")
});