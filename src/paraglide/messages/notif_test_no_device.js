/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Test_No_DeviceInputs */



/**
* | output |
* | --- |
* | "No subscribed device: enable notifications first." |
*
* @param {Notif_Test_No_DeviceInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_test_no_device = /** @type {((inputs?: Notif_Test_No_DeviceInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Test_No_DeviceInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("No subscribed device: enable notifications first.")
	return /** @type {LocalizedString} */ ("Aucun appareil abonné : activez d'abord les notifications.")
});