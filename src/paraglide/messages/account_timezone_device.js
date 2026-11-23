/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ timezone: NonNullable<unknown> }} Account_Timezone_DeviceInputs */



/**
* | output |
* | --- |
* | "This device is set to {timezone}." |
*
* @param {Account_Timezone_DeviceInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_timezone_device = /** @type {((inputs: Account_Timezone_DeviceInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Timezone_DeviceInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`This device is set to ${i?.timezone}.`)
	return /** @type {LocalizedString} */ (`Cet appareil est à l'heure de ${i?.timezone}.`)
});