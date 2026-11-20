/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Test_Err_Rate_LimitedInputs */



/**
* | output |
* | --- |
* | "Provider busy or quota reached: try again later." |
*
* @param {Admin_Ai_Test_Err_Rate_LimitedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_test_err_rate_limited = /** @type {((inputs?: Admin_Ai_Test_Err_Rate_LimitedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Test_Err_Rate_LimitedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Provider busy or quota reached: try again later.")
	return /** @type {LocalizedString} */ ("Fournisseur saturé ou quota atteint : réessayez plus tard.")
});