/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Account_Locations_LinkInputs */



/**
* | output |
* | --- |
* | "Where your bottles are kept" |
*
* @param {Account_Locations_LinkInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_locations_link = /** @type {((inputs?: Account_Locations_LinkInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Locations_LinkInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Where your bottles are kept")
	return /** @type {LocalizedString} */ ("Où sont rangées vos bouteilles")
});