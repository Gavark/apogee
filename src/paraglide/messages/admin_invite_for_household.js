/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Admin_Invite_For_HouseholdInputs */



/**
* | output |
* | --- |
* | "Household: {name}" |
*
* @param {Admin_Invite_For_HouseholdInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_invite_for_household = /** @type {((inputs: Admin_Invite_For_HouseholdInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Invite_For_HouseholdInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Household: ${i?.name}`)
	return /** @type {LocalizedString} */ (`Foyer : ${i?.name}`)
});