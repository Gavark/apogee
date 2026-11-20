/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Password_Confirm_LabelInputs */



/**
* | output |
* | --- |
* | "Confirm password" |
*
* @param {Auth_Password_Confirm_LabelInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const auth_password_confirm_label = /** @type {((inputs?: Auth_Password_Confirm_LabelInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Password_Confirm_LabelInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Confirm password")
	return /** @type {LocalizedString} */ ("Confirmer le mot de passe")
});