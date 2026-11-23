/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Account_Timezone_Use_DeviceInputs */



/**
* | output |
* | --- |
* | "Use this time zone" |
*
* @param {Account_Timezone_Use_DeviceInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_timezone_use_device = /** @type {((inputs?: Account_Timezone_Use_DeviceInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Timezone_Use_DeviceInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Use this time zone")
	return /** @type {LocalizedString} */ ("Utiliser ce fuseau")
});