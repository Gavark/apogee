/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ when: NonNullable<unknown> }} Account_Sessions_Last_UsedInputs */



/**
* | output |
* | --- |
* | "Last active: {when}" |
*
* @param {Account_Sessions_Last_UsedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_sessions_last_used = /** @type {((inputs: Account_Sessions_Last_UsedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Sessions_Last_UsedInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Last active: ${i?.when}`)
	return /** @type {LocalizedString} */ (`Dernière activité : ${i?.when}`)
});