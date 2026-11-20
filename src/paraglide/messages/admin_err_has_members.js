/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Err_Has_MembersInputs */



/**
* | output |
* | --- |
* | "This household still has members." |
*
* @param {Admin_Err_Has_MembersInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_err_has_members = /** @type {((inputs?: Admin_Err_Has_MembersInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Err_Has_MembersInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This household still has members.")
	return /** @type {LocalizedString} */ ("Ce foyer a encore des membres.")
});