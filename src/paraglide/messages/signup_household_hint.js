/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Household_HintInputs */



/**
* | output |
* | --- |
* | "The name your cellar will be shared under." |
*
* @param {Signup_Household_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const signup_household_hint = /** @type {((inputs?: Signup_Household_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Household_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The name your cellar will be shared under.")
	return /** @type {LocalizedString} */ ("Le nom sous lequel votre cave sera partagée.")
});