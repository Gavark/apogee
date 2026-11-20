/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Err_Own_HouseholdInputs */



/**
* | output |
* | --- |
* | "You can't delete your own household." |
*
* @param {Admin_Err_Own_HouseholdInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_err_own_household = /** @type {((inputs?: Admin_Err_Own_HouseholdInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Err_Own_HouseholdInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("You can't delete your own household.")
	return /** @type {LocalizedString} */ ("Vous ne pouvez pas supprimer votre propre foyer.")
});