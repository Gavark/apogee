/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ email: NonNullable<unknown> }} Admin_Confirm_User_BodyInputs */



/**
* | output |
* | --- |
* | "The account {email} will be permanently deleted. Its history stays in the household's cellar." |
*
* @param {Admin_Confirm_User_BodyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_confirm_user_body = /** @type {((inputs: Admin_Confirm_User_BodyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Confirm_User_BodyInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`The account ${i?.email} will be permanently deleted. Its history stays in the household's cellar.`)
	return /** @type {LocalizedString} */ (`Le compte ${i?.email} sera supprimé définitivement. Son historique reste dans la cave du foyer.`)
});