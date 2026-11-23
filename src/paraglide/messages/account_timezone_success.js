/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ timezone: NonNullable<unknown> }} Account_Timezone_SuccessInputs */



/**
* | output |
* | --- |
* | "Time zone saved: {timezone}." |
*
* @param {Account_Timezone_SuccessInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_timezone_success = /** @type {((inputs: Account_Timezone_SuccessInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Timezone_SuccessInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Time zone saved: ${i?.timezone}.`)
	return /** @type {LocalizedString} */ (`Fuseau horaire enregistré : ${i?.timezone}.`)
});