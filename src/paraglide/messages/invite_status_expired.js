/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invite_Status_ExpiredInputs */



/**
* | output |
* | --- |
* | "Expired" |
*
* @param {Invite_Status_ExpiredInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const invite_status_expired = /** @type {((inputs?: Invite_Status_ExpiredInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_Status_ExpiredInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Expired")
	return /** @type {LocalizedString} */ ("Expirée")
});