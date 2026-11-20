/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Password_New_LabelInputs */



/**
* | output |
* | --- |
* | "Password (at least 10 characters)" |
*
* @param {Auth_Password_New_LabelInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const auth_password_new_label = /** @type {((inputs?: Auth_Password_New_LabelInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Password_New_LabelInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Password (at least 10 characters)")
	return /** @type {LocalizedString} */ ("Mot de passe (10 caractères minimum)")
});