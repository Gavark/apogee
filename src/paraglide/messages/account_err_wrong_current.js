/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Account_Err_Wrong_CurrentInputs */



/**
* | output |
* | --- |
* | "The current password is incorrect." |
*
* @param {Account_Err_Wrong_CurrentInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_err_wrong_current = /** @type {((inputs?: Account_Err_Wrong_CurrentInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Err_Wrong_CurrentInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The current password is incorrect.")
	return /** @type {LocalizedString} */ ("Le mot de passe actuel est incorrect.")
});