/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Delete_HouseholdInputs */



/**
* | output |
* | --- |
* | "Delete household" |
*
* @param {Admin_Delete_HouseholdInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_delete_household = /** @type {((inputs?: Admin_Delete_HouseholdInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Delete_HouseholdInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Delete household")
	return /** @type {LocalizedString} */ ("Supprimer le foyer")
});