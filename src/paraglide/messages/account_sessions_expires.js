/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ when: NonNullable<unknown> }} Account_Sessions_ExpiresInputs */



/**
* | output |
* | --- |
* | "expires {when}" |
*
* @param {Account_Sessions_ExpiresInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_sessions_expires = /** @type {((inputs: Account_Sessions_ExpiresInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Sessions_ExpiresInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`expires ${i?.when}`)
	return /** @type {LocalizedString} */ (`expire le ${i?.when}`)
});