/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Admin_Confirm_Household_BodyInputs */



/**
* | output |
* | --- |
* | "The household \"{name}\" and its whole cellar will be permanently deleted. This cannot be undone." |
*
* @param {Admin_Confirm_Household_BodyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_confirm_household_body = /** @type {((inputs: Admin_Confirm_Household_BodyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Confirm_Household_BodyInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`The household "${i?.name}" and its whole cellar will be permanently deleted. This cannot be undone.`)
	return /** @type {LocalizedString} */ (`Le foyer « ${i?.name} » et toute sa cave seront supprimés définitivement. Cette action est irréversible.`)
});