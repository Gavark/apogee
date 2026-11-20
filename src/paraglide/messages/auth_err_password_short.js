/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Err_Password_ShortInputs */



/**
* | output |
* | --- |
* | "The password must be at least 10 characters long." |
*
* @param {Auth_Err_Password_ShortInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const auth_err_password_short = /** @type {((inputs?: Auth_Err_Password_ShortInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Err_Password_ShortInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The password must be at least 10 characters long.")
	return /** @type {LocalizedString} */ ("Le mot de passe doit faire au moins 10 caractères.")
});