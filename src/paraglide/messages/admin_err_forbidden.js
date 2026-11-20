/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Err_ForbiddenInputs */



/**
* | output |
* | --- |
* | "Reserved for the administrator." |
*
* @param {Admin_Err_ForbiddenInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_err_forbidden = /** @type {((inputs?: Admin_Err_ForbiddenInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Err_ForbiddenInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Reserved for the administrator.")
	return /** @type {LocalizedString} */ ("Action réservée à l'administrateur.")
});