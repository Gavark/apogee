/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Account_Sessions_Unknown_UaInputs */



/**
* | output |
* | --- |
* | "Unknown device" |
*
* @param {Account_Sessions_Unknown_UaInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_sessions_unknown_ua = /** @type {((inputs?: Account_Sessions_Unknown_UaInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Sessions_Unknown_UaInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Unknown device")
	return /** @type {LocalizedString} */ ("Appareil inconnu")
});