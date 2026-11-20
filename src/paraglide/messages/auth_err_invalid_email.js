/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Err_Invalid_EmailInputs */



/**
* | output |
* | --- |
* | "This email address isn't valid." |
*
* @param {Auth_Err_Invalid_EmailInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const auth_err_invalid_email = /** @type {((inputs?: Auth_Err_Invalid_EmailInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Err_Invalid_EmailInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This email address isn't valid.")
	return /** @type {LocalizedString} */ ("Cette adresse e-mail n'est pas valide.")
});