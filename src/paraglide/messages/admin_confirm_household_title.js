/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Confirm_Household_TitleInputs */



/**
* | output |
* | --- |
* | "Delete this household?" |
*
* @param {Admin_Confirm_Household_TitleInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_confirm_household_title = /** @type {((inputs?: Admin_Confirm_Household_TitleInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Confirm_Household_TitleInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Delete this household?")
	return /** @type {LocalizedString} */ ("Supprimer ce foyer ?")
});