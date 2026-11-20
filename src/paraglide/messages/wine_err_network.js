/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Err_NetworkInputs */



/**
* | output |
* | --- |
* | "Cannot connect. Please try again." |
*
* @param {Wine_Err_NetworkInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_err_network = /** @type {((inputs?: Wine_Err_NetworkInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Err_NetworkInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Cannot connect. Please try again.")
	return /** @type {LocalizedString} */ ("Connexion impossible. Réessayez.")
});