/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Account_Admin_LinkInputs */



/**
* | output |
* | --- |
* | "Households, invitations and accounts" |
*
* @param {Account_Admin_LinkInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_admin_link = /** @type {((inputs?: Account_Admin_LinkInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Admin_LinkInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Households, invitations and accounts")
	return /** @type {LocalizedString} */ ("Foyers, invitations et comptes")
});