/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Err_Already_SetupInputs */



/**
* | output |
* | --- |
* | "This installation is already set up. Sign in." |
*
* @param {Auth_Err_Already_SetupInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const auth_err_already_setup = /** @type {((inputs?: Auth_Err_Already_SetupInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Err_Already_SetupInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This installation is already set up. Sign in.")
	return /** @type {LocalizedString} */ ("Cette installation est déjà configurée. Connectez-vous.")
});