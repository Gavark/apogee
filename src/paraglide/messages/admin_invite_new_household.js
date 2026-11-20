/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Invite_New_HouseholdInputs */



/**
* | output |
* | --- |
* | "New household" |
*
* @param {Admin_Invite_New_HouseholdInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_invite_new_household = /** @type {((inputs?: Admin_Invite_New_HouseholdInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Invite_New_HouseholdInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("New household")
	return /** @type {LocalizedString} */ ("Nouveau foyer")
});