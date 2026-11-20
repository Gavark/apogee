/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Err_Password_MismatchInputs */



/**
* | output |
* | --- |
* | "The two passwords don't match." |
*
* @param {Auth_Err_Password_MismatchInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const auth_err_password_mismatch = /** @type {((inputs?: Auth_Err_Password_MismatchInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Err_Password_MismatchInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The two passwords don't match.")
	return /** @type {LocalizedString} */ ("Les deux mots de passe ne correspondent pas.")
});