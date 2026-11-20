/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Btn_ErrorInputs */



/**
* | output |
* | --- |
* | "Could not enable notifications. Try again." |
*
* @param {Notif_Btn_ErrorInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_btn_error = /** @type {((inputs?: Notif_Btn_ErrorInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Btn_ErrorInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Could not enable notifications. Try again.")
	return /** @type {LocalizedString} */ ("Impossible d'activer les notifications. Réessayez.")
});