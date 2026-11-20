/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Account_Sessions_CurrentInputs */



/**
* | output |
* | --- |
* | "This device" |
*
* @param {Account_Sessions_CurrentInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_sessions_current = /** @type {((inputs?: Account_Sessions_CurrentInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Sessions_CurrentInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This device")
	return /** @type {LocalizedString} */ ("Cet appareil")
});