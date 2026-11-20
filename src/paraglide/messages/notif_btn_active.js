/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Btn_ActiveInputs */



/**
* | output |
* | --- |
* | "Notifications are on for this device" |
*
* @param {Notif_Btn_ActiveInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_btn_active = /** @type {((inputs?: Notif_Btn_ActiveInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Btn_ActiveInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Notifications are on for this device")
	return /** @type {LocalizedString} */ ("Notifications activées sur cet appareil")
});