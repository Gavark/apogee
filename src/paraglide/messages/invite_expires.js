/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ when: NonNullable<unknown> }} Invite_ExpiresInputs */



/**
* | output |
* | --- |
* | "expires {when}" |
*
* @param {Invite_ExpiresInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const invite_expires = /** @type {((inputs: Invite_ExpiresInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_ExpiresInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`expires ${i?.when}`)
	return /** @type {LocalizedString} */ (`expire le ${i?.when}`)
});