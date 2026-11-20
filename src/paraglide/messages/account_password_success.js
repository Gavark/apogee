/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Account_Password_SuccessInputs */



/**
* | output |
* | --- |
* | "Password changed. Other devices have been signed out." |
*
* @param {Account_Password_SuccessInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_password_success = /** @type {((inputs?: Account_Password_SuccessInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Password_SuccessInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Password changed. Other devices have been signed out.")
	return /** @type {LocalizedString} */ ("Mot de passe modifié. Les autres appareils sont déconnectés.")
});