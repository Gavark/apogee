/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Err_Rate_LimitedInputs */



/**
* | output |
* | --- |
* | "Too many attempts, try again in 15 minutes." |
*
* @param {Auth_Err_Rate_LimitedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const auth_err_rate_limited = /** @type {((inputs?: Auth_Err_Rate_LimitedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Err_Rate_LimitedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Too many attempts, try again in 15 minutes.")
	return /** @type {LocalizedString} */ ("Trop de tentatives, réessayez dans 15 minutes.")
});