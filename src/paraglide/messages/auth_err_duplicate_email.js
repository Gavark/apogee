/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Err_Duplicate_EmailInputs */



/**
* | output |
* | --- |
* | "An account already exists with this address." |
*
* @param {Auth_Err_Duplicate_EmailInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const auth_err_duplicate_email = /** @type {((inputs?: Auth_Err_Duplicate_EmailInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Err_Duplicate_EmailInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("An account already exists with this address.")
	return /** @type {LocalizedString} */ ("Un compte existe déjà avec cette adresse.")
});