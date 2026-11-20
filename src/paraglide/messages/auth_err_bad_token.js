/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Err_Bad_TokenInputs */



/**
* | output |
* | --- |
* | "This invitation is invalid, expired or already used." |
*
* @param {Auth_Err_Bad_TokenInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const auth_err_bad_token = /** @type {((inputs?: Auth_Err_Bad_TokenInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Err_Bad_TokenInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This invitation is invalid, expired or already used.")
	return /** @type {LocalizedString} */ ("Cette invitation est invalide, expirée ou déjà utilisée.")
});