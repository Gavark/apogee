/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Test_FailedInputs */



/**
* | output |
* | --- |
* | "Sending failed. Try again in a moment." |
*
* @param {Notif_Test_FailedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_test_failed = /** @type {((inputs?: Notif_Test_FailedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Test_FailedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Sending failed. Try again in a moment.")
	return /** @type {LocalizedString} */ ("L'envoi a échoué. Réessayez dans un moment.")
});