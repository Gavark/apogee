/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Err_Household_Too_LongInputs */



/**
* | output |
* | --- |
* | "The household name can't exceed 100 characters." |
*
* @param {Auth_Err_Household_Too_LongInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const auth_err_household_too_long = /** @type {((inputs?: Auth_Err_Household_Too_LongInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Err_Household_Too_LongInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The household name can't exceed 100 characters.")
	return /** @type {LocalizedString} */ ("Le nom du foyer ne peut pas dépasser 100 caractères.")
});