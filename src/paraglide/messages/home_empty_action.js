/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Home_Empty_ActionInputs */



/**
* | output |
* | --- |
* | "Add a wine" |
*
* @param {Home_Empty_ActionInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const home_empty_action = /** @type {((inputs?: Home_Empty_ActionInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_Empty_ActionInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Add a wine")
	return /** @type {LocalizedString} */ ("Ajouter un vin")
});