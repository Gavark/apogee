/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Account_Notifications_LinkInputs */



/**
* | output |
* | --- |
* | "Drinking phases and monthly reminder" |
*
* @param {Account_Notifications_LinkInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_notifications_link = /** @type {((inputs?: Account_Notifications_LinkInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Notifications_LinkInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Drinking phases and monthly reminder")
	return /** @type {LocalizedString} */ ("Phases à boire et rappel mensuel")
});