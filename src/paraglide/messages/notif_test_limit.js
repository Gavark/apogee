/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Test_LimitInputs */



/**
* | output |
* | --- |
* | "Limit reached: 3 test notifications per hour." |
*
* @param {Notif_Test_LimitInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_test_limit = /** @type {((inputs?: Notif_Test_LimitInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Test_LimitInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Limit reached: 3 test notifications per hour.")
	return /** @type {LocalizedString} */ ("Limite atteinte : 3 notifications de test par heure.")
});