/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Account_Timezone_SubmitInputs */



/**
* | output |
* | --- |
* | "Save time zone" |
*
* @param {Account_Timezone_SubmitInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_timezone_submit = /** @type {((inputs?: Account_Timezone_SubmitInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Timezone_SubmitInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Save time zone")
	return /** @type {LocalizedString} */ ("Enregistrer le fuseau")
});