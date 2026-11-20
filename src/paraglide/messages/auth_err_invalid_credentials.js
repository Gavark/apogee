/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Err_Invalid_CredentialsInputs */



/**
* | output |
* | --- |
* | "Wrong email address or password." |
*
* @param {Auth_Err_Invalid_CredentialsInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const auth_err_invalid_credentials = /** @type {((inputs?: Auth_Err_Invalid_CredentialsInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Err_Invalid_CredentialsInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Wrong email address or password.")
	return /** @type {LocalizedString} */ ("Adresse e-mail ou mot de passe incorrect.")
});